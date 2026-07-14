# ComfyUI Civitai Manager

一个以 UI 和 HTTP API 形式运行的 ComfyUI 扩展，用于浏览、下载和整理 Civitai 上的 Checkpoint、UNet、LoRA 与 Workflow。它不会向工作流节点菜单注册节点。

## 功能

- Discover：搜索和筛选 Civitai 模型，查看版本、文件、预览与触发词。
- Downloads：按照基础模型和分类自动生成保存路径，并保存元数据与预览图。
- Library：扫描本地模型库，支持移动、重命名、收藏、删除和通过 SHA256 补全元数据。
- Settings：配置 API Key、NSFW、Workflow 目录和伴随文件保存选项。

## 安装

将本目录放入 ComfyUI 的 `custom_nodes` 目录，然后重启 ComfyUI。扩展只使用 Python 标准库以及 ComfyUI 已提供的 `aiohttp`、`folder_paths` 和 `PromptServer`，不需要额外运行时依赖。

配置保存在 ComfyUI 用户目录下的 `civitai_manager/config.json`。API Key 不会通过配置读取接口返回给浏览器。

## 项目结构

```text
civitaimanager/
├── __init__.py                 # ComfyUI 扩展入口与 Web 目录声明
├── nodes.py                    # 导入后端并注册 API；不注册工作流节点
├── manager_api.py              # Civitai 客户端、下载、本地库和 HTTP 路由
├── js/
│   └── civitai_manager.js      # UI、状态、API 客户端和样式
└── tests/
    └── test_manager_api.py     # 后端核心逻辑回归测试
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
```

下载任务在内存中管理：最多保留 100 条已结束记录，结束 24 小时后自动清理。ComfyUI 重启后任务历史不会恢复。

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
python -c "import ast,pathlib; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'), filename=p) for p in ['__init__.py','nodes.py','manager_api.py']]"
node --check js\civitai_manager.js
```

单元测试使用临时目录和 ComfyUI 模块替身，不访问网络，也不会修改真实模型目录。覆盖路径逃逸、配置校验、搜索回退、下载状态、Library 扫描、资源移动/删除、companion 文件和元数据补全。

## 当前工程边界

- 下载任务、搜索分类缓存和配置缓存都属于单个 ComfyUI 进程。
- Library 当前按请求扫描模型目录，大型模型库后续应增加索引缓存。
- 远程媒体代理保持兼容模式，可转发模型数据中提供的 HTTP/HTTPS 预览地址。
