# AI Image Station

AI 图片生成工作站 - 前端直连 AI API，本地图床管理。

## 项目结构

```
├── backend/          # Go 后端服务 (图床 + 认证)
│   ├── cmd/server/   # 入口
│   └── internal/     # 业务逻辑
├── frontend/         # React 19 + Vite 8 前端
│   └── src/
│       ├── api/      # API 调用层
│       ├── components/
│       ├── lib/      # 工具函数
│       ├── pages/    # 页面组件
│       └── stores/   # 状态管理
├── Dockerfile        # 多阶段构建
├── docker-compose.yaml
├── nginx.conf        # 反向代理配置
└── .env.example      # 环境变量模板
