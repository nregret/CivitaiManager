"""ComfyUI entrypoint for Civitai Manager.

The v1 manager is a UI and API extension rather than a graph node package.
"""

try:
    from . import manager_api  # noqa: F401 - importing registers HTTP routes
except Exception as exc:
    print(f"[Civitai Manager] Failed to register API routes: {exc}")


NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
