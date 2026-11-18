
const MAX_ENTRIES = 500;

const entries = [];          
const statusCounts = {};     
let totalRequests = 0;
const startedAt = new Date();

function summarize(body) {
    let text = '';
    if (Array.isArray(body)) {
        text = `${body.length} rows`;
    } else if (body && typeof body === 'object') {
        if (body.error) text = String(body.error);
        else if (body.message) text = String(body.message);
        else text = `{${Object.keys(body).join(', ')}}`;
    }
    return text.length > 120 ? text.slice(0, 117) + '...' : text;
}

exports.requestLogger = (req, res, next) => {
    // do not log the dev page reading the log itself (it would flood the list)
    if (req.originalUrl.startsWith('/dev/request-log')) return next();

    const started = process.hrtime.bigint();
    let summary = '';

    const originalJson = res.json.bind(res);
    res.json = (body) => {
        summary = summarize(body);
        return originalJson(body);
    };

    res.on('finish', () => {
        const entry = {
            time: new Date().toISOString(),
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            duration_ms: Number(process.hrtime.bigint() - started) / 1e6,
            user: req.user ? req.user.username : null,
            role: req.user ? req.user.role : null,
            summary
        };
        entry.duration_ms = Math.round(entry.duration_ms * 10) / 10;
        entry.line = `${entry.status}  ${entry.method} ${entry.path}` + (summary ? ` → ${summary}` : '');

        entries.push(entry);
        if (entries.length > MAX_ENTRIES) entries.shift();
        statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1;
        totalRequests++;
    });

    next();
};

// status: "404" (exact) or "4xx" (class). limit: 1..MAX_ENTRIES. Newest first.
exports.getLog = ({ limit = 100, status } = {}) => {
    let list = entries;
    if (status) {
        const s = String(status).toLowerCase();
        list = s.endsWith('xx')
            ? entries.filter(e => String(e.status)[0] === s[0])
            : entries.filter(e => String(e.status) === s);
    }
    const n = Math.min(Math.max(parseInt(limit, 10) || 100, 1), MAX_ENTRIES);
    return {
        since: startedAt.toISOString(),
        total_requests: totalRequests,
        by_status: { ...statusCounts },
        entries: list.slice(-n).reverse()
    };
};
