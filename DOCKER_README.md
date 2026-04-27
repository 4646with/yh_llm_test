# 大模型接口测试面板 - Docker 部署指南

## 快速启动

使用以下命令启动服务：

```bash
docker-compose up -d
```

容器将在内部运行，端口未暴露。

## 停止服务

```bash
docker-compose down
```

## 查看日志

```bash
docker-compose logs -f
```

## 重新构建镜像

如果修改了代码，需要重新构建：

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

## 环境变量

可以通过修改 `docker-compose.yml` 中的 `environment` 部分来设置环境变量：

```yaml
environment:
  - PORT=3000  # 容器内部端口
```

## 数据持久化

日志文件会挂载到宿主机的 `./logs` 目录。

## 故障排查

1. 构建失败：检查网络连接和 Docker 镜像源
2. 服务状态异常：检查容器日志
3. 依赖问题：确保网络连接正常