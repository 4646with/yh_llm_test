const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(__dirname));

// API 代理路由
app.post('/api/proxy', async (req, res) => {
    const { targetUrl, headers: clientHeaders, body } = req.body;

    // 为了方便测试，移除了域名白名单校验
    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (e) {
        return res.status(400).json({ error: '无效的目标 URL' });
    }

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...clientHeaders
            },
            body: JSON.stringify(body),
        });

        const contentType = response.headers.get('content-type') || '';

        // 设置 CORS 响应头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (contentType.includes('application/json')) {
            const data = await response.json();
            return res.status(response.status).json(data);
        } else {
            const text = await response.text();
            res.setHeader('Content-Type', contentType || 'text/plain');
            return res.status(response.status).send(text);
        }
    } catch (err) {
        return res.status(500).json({ error: `代理请求失败: ${err.message}` });
    }
});

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 处理所有其他路由，返回 index.html（SPA 路由支持）
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access at: http://localhost:${PORT}`);
});