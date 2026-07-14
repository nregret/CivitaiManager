from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import sys
import tempfile
import time
import types
import unittest
from pathlib import Path
from unittest import mock


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class _FakeRoutes:
    def get(self, _path):
        return lambda handler: handler

    def post(self, _path):
        return lambda handler: handler


class _FakeResponse:
    def __init__(self, body=None, status=200, **_kwargs):
        self.body = body
        self.status = status
        self.headers = {}


def _fake_json_response(payload, status=200, **_kwargs):
    return _FakeResponse(body=payload, status=status)


def _load_manager_api():
    folder_paths = types.ModuleType("folder_paths")
    folder_paths.models_dir = str(PROJECT_ROOT / ".test-models")
    folder_paths.get_user_directory = lambda: str(PROJECT_ROOT / ".test-user")
    folder_paths.get_folder_paths = lambda _name: []

    server = types.ModuleType("server")
    server.PromptServer = types.SimpleNamespace(
        instance=types.SimpleNamespace(routes=_FakeRoutes())
    )

    aiohttp = types.ModuleType("aiohttp")
    aiohttp.web = types.SimpleNamespace(
        Request=object,
        Response=_FakeResponse,
        StreamResponse=_FakeResponse,
        FileResponse=_FakeResponse,
        json_response=_fake_json_response,
    )

    sys.modules["folder_paths"] = folder_paths
    sys.modules["server"] = server
    sys.modules["aiohttp"] = aiohttp
    module_name = "civitai_manager_test_manager_api"
    sys.modules.pop(module_name, None)
    spec = importlib.util.spec_from_file_location(module_name, PROJECT_ROOT / "manager_api.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load manager_api.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


manager = _load_manager_api()


class PathAndConfigTests(unittest.TestCase):
    def test_safe_join_rejects_parent_escape(self):
        with tempfile.TemporaryDirectory() as root:
            inside = manager._safe_join(root, "base", "model.safetensors")
            self.assertEqual(
                inside,
                os.path.abspath(os.path.join(root, "base", "model.safetensors")),
            )
            with self.assertRaises(ValueError):
                manager._safe_join(root, "..", "outside.safetensors")

    def test_public_config_never_returns_api_key(self):
        config = {
            "civitai_api_key": "secret",
            "allow_nsfw": False,
            "workflow_dir": "workflows",
            "save_metadata": True,
            "save_preview": True,
        }
        with mock.patch.object(manager, "_root_display", return_value={}):
            public = manager._public_config(config)
        self.assertEqual(public["civitai_api_key"], "")
        self.assertTrue(public["api_key_set"])


class DownloadJobTests(unittest.TestCase):
    def setUp(self):
        self.original_jobs = manager._DOWNLOAD_JOBS
        manager._DOWNLOAD_JOBS = {}

    def tearDown(self):
        manager._DOWNLOAD_JOBS = self.original_jobs

    def test_active_count_only_includes_pending_and_downloading(self):
        manager._DOWNLOAD_JOBS.update({
            "pending": {"status": "pending"},
            "running": {"status": "downloading"},
            "done": {"status": "completed"},
            "failed": {"status": "failed"},
        })
        with manager._DOWNLOAD_LOCK:
            self.assertEqual(manager._active_download_job_count_locked(), 2)

    def test_prune_expires_old_jobs_and_caps_finished_history(self):
        now = 10_000
        manager._DOWNLOAD_JOBS.update({
            "active": {"status": "pending", "created_at": 1},
            "expired": {"status": "completed", "completed_at": 100},
            "newest": {"status": "completed", "completed_at": 9_900},
            "middle": {"status": "failed", "failed_at": 9_800},
            "oldest-retained": {"status": "completed", "completed_at": 9_700},
        })
        with (
            mock.patch.object(manager, "DOWNLOAD_JOB_RETENTION_SECONDS", 1_000),
            mock.patch.object(manager, "DOWNLOAD_JOB_HISTORY_LIMIT", 2),
            manager._DOWNLOAD_LOCK,
        ):
            manager._prune_download_jobs_locked(now)

        self.assertEqual(set(manager._DOWNLOAD_JOBS), {"active", "newest", "middle"})


class DownloadApiAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_jobs = manager._DOWNLOAD_JOBS
        manager._DOWNLOAD_JOBS = {}

    async def asyncTearDown(self):
        manager._DOWNLOAD_JOBS = self.original_jobs

    async def test_rejects_when_active_job_limit_is_reached(self):
        class Request:
            async def json(self):
                return {}

        for index in range(manager.DOWNLOAD_MAX_ACTIVE_JOBS):
            manager._DOWNLOAD_JOBS[str(index)] = {
                "status": "pending",
                "created_at": index + 1,
            }
        resolution = {
            "root_kind": "loras",
            "absolute_path": "model.safetensors",
            "relative_path": "Other/Other/model.safetensors",
            "filename": "model.safetensors",
            "download_url": "https://civitai.red/api/download/model",
            "base_model_dir": "Other",
            "category_dir": "Other",
        }
        with (
            mock.patch.object(manager, "_ensure_download_workers"),
            mock.patch.object(manager, "resolve_download_path", return_value=resolution),
        ):
            response = await manager.download_api(Request())

        self.assertEqual(response.status, 429)
        self.assertEqual(len(manager._DOWNLOAD_JOBS), manager.DOWNLOAD_MAX_ACTIVE_JOBS)


class MetadataWorkerTests(unittest.TestCase):
    def test_worker_hashes_and_writes_companion_metadata(self):
        with tempfile.TemporaryDirectory() as root:
            asset = Path(root) / "model.safetensors"
            asset.write_bytes(b"model-data")
            civitai_data = {
                "id": 22,
                "name": "Version",
                "baseModel": "SDXL 1.0",
                "trainedWords": ["trigger"],
                "model": {
                    "id": 11,
                    "name": "Example",
                    "type": "LORA",
                    "creator": {"username": "tester"},
                },
            }
            with mock.patch.object(manager, "_metadata_from_hash", return_value=civitai_data):
                result = manager._enrich_metadata_worker(str(asset), "loras")

            metadata_path = asset.with_suffix(".json")
            self.assertTrue(metadata_path.is_file())
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            self.assertTrue(result["matched"])
            self.assertEqual(metadata["model_id"], 11)
            self.assertEqual(metadata["version_id"], 22)
            self.assertEqual(metadata["hashes"]["SHA256"], result["sha256"].upper())


class MetadataApiAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_enrichment_runs_without_blocking_event_loop(self):
        class Request:
            async def json(self):
                return {"root_kind": "loras", "relative_path": "model.safetensors"}

        with tempfile.TemporaryDirectory() as root:
            asset = Path(root) / "model.safetensors"
            asset.write_bytes(b"model-data")

            def slow_worker(_path, _kind):
                time.sleep(0.08)
                return {"sha256": "abc", "metadata": {}, "matched": False}

            with (
                mock.patch.object(manager, "_resolve_asset_path", return_value=str(asset)),
                mock.patch.object(manager, "_enrich_metadata_worker", side_effect=slow_worker),
            ):
                task = asyncio.create_task(manager.enrich_metadata_api(Request()))
                await asyncio.sleep(0.02)
                self.assertFalse(task.done())
                marker = []
                await asyncio.sleep(0)
                marker.append("event-loop-responsive")
                response = await task

        self.assertEqual(marker, ["event-loop-responsive"])
        self.assertEqual(response.status, 200)


if __name__ == "__main__":
    unittest.main()
