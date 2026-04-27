// Vercel Serverless Function 代理
// 将浏览器请求转发到目标 API，绕过 CORS 限制

export default async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { targetUrl, headers: clientHeaders, body } = req.body;

    // 安全校验：只允许代理特定域名
    const allowedHosts = [
        'pinova.ai',
        'burncloud.com',
        'csp.burncloud.com',
        'tmpfiles.org'
    ];
    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (e) {
        return res.status(400).json({ error: '无效的目标 URL' });
    }

    const isAllowed = allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h));
    if (!isAllowed) {
        return res.status(403).json({ error: `目标域名 ${parsedUrl.hostname} 不在白名单中` });
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
        
        // 设置 CORS 响应头，允许所有来源访问此代理
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
}
