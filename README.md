# CivitaiManager

`CivitaiManager` 是一个以 UI、HTTP API 和工作流节点形式运行的 ComfyUI 扩展，用于浏览、下载和整理 Civitai 上的 Checkpoint、UNet、LoRA 与 Workflow。

## 功能

- Discover：搜索和筛选 Civitai 模型，查看版本、文件、预览与触发词。
- Downloads：按照基础模型和分类自动生成保存路径，并保存元数据与预览图。
- Downloads 支持取消和重试；历史写入用户目录，ComfyUI 重启后仍可查看。
- Library：扫描本地模型库，支持移动、重命名、收藏、删除和通过 SHA256 补全元数据。
- Favorites：远程模型无需下载即可收藏；大管理器统一展示 Checkpoint、UNet、LoRA 与 Workflow，LoRA 管理器只展示 LoRA。支持新建、重命名、删除收藏夹及移动收藏条目。
- Settings：配置 API Key、NSFW、Workflow 目录和伴随文件保存选项。
- Multi LoRA Loader：按顺序启用和调整多个 LoRA；节点内的精简 LoRA 管理器支持搜索、下载后自动应用、本地管理和下载任务控制。

## 安装

在 ComfyUI 的 `custom_nodes` 目录中执行：

```powershell
git clone https://github.com/nregret/CivitaiManager.git
```

然后重启 ComfyUI。扩展只使用 Python 标准库以及 ComfyUI 已提供的 `aiohttp`、`folder_paths` 和 `PromptServer`，不需要额外运行时依赖。

配置保存在 ComfyUI 用户目录下的 `civitai_manager/config.json`，收藏与自定义收藏夹保存在同目录的 `favorites.json`，更新或重装插件不会覆盖。API Key 不会通过配置读取接口返回给浏览器。

为兼容既有安装与用户数据，内部 HTTP 路由 `/civitai-manager/api` 以及用户数据目录 `civitai_manager` 保持不变。

## 项目结构

```text
CivitaiManager/
├── __init__.py                 # ComfyUI 扩展入口与 Web 目录声明
├── nodes.py                    # 注册后端 API 与 Multi LoRA Loader 节点
├── manager_api.py              # 后端编排与 API handler
├── backend/
│   ├── client.py               # Civitai 请求辅助
│   ├── config.py               # 配置校验
│   ├── downloads.py            # 持久化下载任务存储
│   ├── library.py              # Library 索引缓存
│   └── routes.py               # HTTP 路由表
├── js/
│   ├── civitai_manager.js      # UI 编排与交互
│   ├── civitai_lora_node.js    # 多 LoRA 节点控件与 LoRA 专用弹窗
│   └── civitai/                # 常量、状态、API、收藏、样式、i18n
├── locales/{en,zh}/            # ComfyUI 官方 locale 资源
├── pyproject.toml              # Comfy Registry 发布元数据
└── tests/
    ├── test_manager_api.py     # 后端核心逻辑回归测试
    └── test_nodes.py           # 多 LoRA 节点解析、路径与执行测试
```

主要数据流：

```text
ComfyUI Browser UI
        │
        ▼
/civitai-manager/api/*
        ├── Civitai API：搜索、详情、元数据
        ├── Download Queue：3 个后台 worker，最多 20 个活动任务
        └── Local Library：扫描并管理模型和 companion 文件

MODEL → Civitai Multi LoRA Loader → MODEL
                  │
                  └── lora_list_json：按界面顺序保存路径、强度和启用状态
```

下载任务写入 ComfyUI 用户目录的 `civitai_manager/downloads.json`：最多保留 100 条已结束记录，结束 24 小时后自动清理。重启时仍处于队列或下载中的任务会标记为失败，并可从界面重试。

收藏以 Civitai 模型 ID 和资源类型作为稳定标识。远程模型被收藏后再下载到本地时会合并成同一条记录；旧版写在本地 companion 元数据中的收藏会在首次加载时自动迁移。

Library 扫描结果默认缓存 30 秒；下载完成或本地资产发生移动、删除、收藏、元数据更新时自动失效，也可以点击 Refresh 强制重建。

## 数据安全约束

- 本地资源接口只接受对应类型的资源文件扩展名，不允许直接操作 companion JSON。
- Checkpoint 与 UNet 可以互相移动；LoRA 和 Workflow 只能在各自类型目录中移动。
- 移动前会检查目标资源及 companion 文件冲突；中途失败时会尽力回滚已移动文件。
- 移动完成后会同步更新 companion 元数据中的根目录、分类、文件名和相对路径。
- Workflow 目录必须是有效目录路径，配置布尔值会进行显式解析，不使用字符串真值推断。

## 开发与验证

在本目录运行：

```powershell
python -m unittest discover -s tests -v
python -c "import ast,pathlib; files=list(pathlib.Path('.').glob('*.py'))+list(pathlib.Path('backend').glob('*.py')); [ast.parse(p.read_text(encoding='utf-8'), filename=str(p)) for p in files]"
Get-ChildItem js -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

单元测试使用临时目录和 ComfyUI 模块替身，不访问网络，也不会修改真实模型目录。覆盖路径逃逸、配置校验、搜索回退、下载状态、Library 扫描、资源移动/删除、companion 文件和元数据补全。

## 当前工程边界

- 搜索分类缓存和配置缓存属于单个 ComfyUI 进程。
- 取消下载在网络读取边界生效；底层阻塞读取可能需要等待当前读取或超时返回。
- 远程媒体代理保持兼容模式，可转发模型数据中提供的 HTTP/HTTPS 预览地址。
