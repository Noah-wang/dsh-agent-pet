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

把鼠标移到宠物上，点左上角的 🎨 打开工作室。填写名字、外观描述（8–800 字符）和画风，点「开始绘制」，插件会生成一张透明背景 PNG 并立刻替换当前形象。点「恢复默认」回到内置的 Momo。

绘制需要图片服务的 API Key。默认从 DSH 凭据服务读取 `OPENAI_API_KEY`；没有配置时工作室会直接提示，不会发起请求。

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

这是 `0.2.0`。发布包已支持本地或 Git 仓库安装，以及 AI 绘制宠物形象，但暂不包含多帧精灵图、社区账号提交、云同步、ESP32 通信或可执行第三方宠物插件。
