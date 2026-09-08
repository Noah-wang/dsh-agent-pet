# DSH Agent Pet

一个运行在 DeepSeek Harness Web UI 右下角的 Agent 宠物。Momo 会随 Agent 的思考、工具调用、等待确认、完成和错误状态改变动作。

## 本地安装

在 DSH 源码目录执行：

```bash
pnpm dsh plugin --profile web add /absolute/path/to/dsh-agent-pet
```

然后重新启动 Web UI：

```bash
pnpm dsh web
```

## 从 GitHub 安装

```bash
dsh plugin --profile web add github:Noah-wang/dsh-agent-pet
```

## 卸载

```bash
dsh plugin --profile web remove dsh-agent-pet
```

修改插件集合后重新启动 DSH Web UI。

## 状态

| 状态 | 行为 |
| --- | --- |
| `idle` | 缓慢呼吸 |
| `thinking` | 左右思考并显示星光 |
| `running_tool` | 工作跳动并旋转齿轮 |
| `waiting_approval` | 橙色提示并等待确认 |
| `done` | 跳跃庆祝 |
| `error` | 摇晃并显示错误提示 |

## 宠物工作室（AI 绘制）

把鼠标移到宠物上，点左上角的 🎨 打开工作室。填写名字、外观描述（8–800 字符）和画风，点「开始绘制」，插件会生成一张**八格精灵表**并立刻替换当前形象。点「恢复默认」回到内置的 Momo。

### 每个状态一个动作

一次生成会画出同一只宠物的八个姿势，排成 4×2 网格：

| 格 | 姿势 | 什么时候出现 |
| --- | --- | --- |
| 1 | `idle` | 待命 |
| 2 | `thinking` | 思考 |
| 3 | `running_tool` | 跑起来执行工具 |
| 4 | `waiting_approval` | 坐直了看着你等确认 |
| 5 | `done` | 跳起来庆祝 |
| 6 | `error` | 低头沮丧 |
| 7 | `resting` | 趴着睡（预留） |
| 8 | `greeting` | 挥爪打招呼（预留） |

一次生成保证八格是同一只宠物——分开生成八次只会得到八只不同的动物。界面按当前状态用 CSS 切换格子，不解码图片。

后两格暂时没有触发来源，先占好位置，以后不用重新生成形象。

### 用别的 AI 生成（不需要 API Key）

展开工作室里的「用别的 AI 生成」：

1. 填好名字和描述，点「生成提示词」
2. 复制这段自包含的提示词，粘贴到任意生图 AI
3. 让它输出一张**透明背景**的 4×2 精灵表 PNG
4. 回来点「导入精灵表 PNG」选中那张图

如果那个 AI 只能出别的网格，把「列 / 行」改成实际值再导入；填 1×1 就是单张图。图片尺寸必须能被网格整除，否则每格都会偏移。

这条路径不需要任何 API Key，也不产生费用。

### 用自己的 API Key 绘制

「开始绘制」需要图片服务的 API Key。默认从 DSH 凭据服务读取 `OPENAI_API_KEY`；没有配置时工作室会直接提示，不会发起请求。

可以在插件配置里调整：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `apiKeyEnv` | `OPENAI_API_KEY` | 凭据引用名 |
| `model` | `gpt-image-2` | 图片模型 |
| `baseURL` | `https://api.openai.com/v1` | 服务地址 |
| `quality` | `medium` | `low` / `medium` / `high` |
| `dataDir` | `<DSH_HOME>/agent-pet` | 生成结果的存放目录 |

画风预设：`auto`、`pixel`、`sticker`、`plush`、`flat-vector`、`3d-toy`。

绘制会调用第三方图片服务并可能产生费用，因此只在你点击按钮时发生；同一时间只允许一次生成，重复请求返回 `409`。生成结果只接受合法 PNG，写入使用原子替换，API Key 不会进入浏览器状态、响应或元数据。

## 自定义宠物

编辑 `pets/default/pet.md` 可以修改名字、SVG 和每个状态的短文案。`avatar` 只接受 `pet.md` 同目录下的本地相对路径；Markdown 不会执行脚本、命令或 HTML。

## 权限与隐私

插件只观察 Agent 生命周期和工具名称，不保存对话正文、工具参数、工具结果、API Key 或其他凭证。客户端只请求 DSH 本机同源接口，不访问第三方网络。详细边界见 [`SECURITY.md`](SECURITY.md)。

## 本地状态测试

Web UI 运行后，可以通过本地 API 切换状态：

```bash
curl -X POST http://127.0.0.1:3080/api/agent-pet \
  -H 'content-type: application/json' \
  -d '{"state":"thinking"}'
```

支持 `idle`、`thinking`、`running_tool`、`waiting_approval`、`done`、`error`。

## 当前范围

这是 `0.3.0`。发布包已支持本地或 Git 仓库安装、AI 绘制八格精灵表、导出提示词到别的 AI、导入外部精灵表，但暂不包含逐帧动画、社区账号提交、云同步、ESP32 通信或可执行第三方宠物插件。
