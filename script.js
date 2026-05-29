const CONFIG = {
    username: "yunshuifuyao-ship-it",
    repo: "my-blog",
    folder: "posts"
};

// 本地文章全局缓存，用于毫秒级模糊搜索
let ALL_POSTS_CACHE = [];

document.addEventListener("DOMContentLoaded", () => {
    initThemeEngine();     // 1. 初始化系统时间/色调检测引擎
    initRainbowCanvas();   // 2. 注入动态鼠标彩虹
    fetchAndParsePosts();  // 3. 抓取文章并运行解析器
    initSearchEngine();    // 4. 启动即时搜索系统
});

// ==================== 1. 自动跟随系统颜色偏好 ====================
function initThemeEngine() {
    const themeBtn = document.getElementById("theme-toggle");
    const body = document.body;

    // 自动判定系统是否处于深色偏好模式
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme = systemPrefersDark ? "dark-mode" : "light-mode";
    
    // 如果本地之前手动选过，以选过的为准，否则跟随系统
    const savedTheme = localStorage.getItem("blog-theme") || defaultTheme;
    body.className = savedTheme;

    themeBtn.addEventListener("click", () => {
        if (body.classList.contains("dark-mode")) {
            body.classList.replace("dark-mode", "light-mode");
            localStorage.setItem("blog-theme", "light-mode");
        } else {
            body.classList.replace("light-mode", "dark-mode");
            localStorage.setItem("blog-theme", "dark-mode");
        }
    });

    // 实时监听系统颜色模式的改变（比如到了晚间系统自动切换）
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem("blog-theme")) { // 只有在用户没手动锁死主题的情况下才自动跟随
            body.className = e.matches ? "dark-mode" : "light-mode";
        }
    });
}

// ==================== 2. 高级元数据 (Front Matter) 解析引擎 ====================
function parseFrontMatter(rawMdText, fallbackTitle) {
    const regex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
    const match = rawMdText.match(regex);
    
    let meta = { title: fallbackTitle, description: "点击阅读正文...", tags: [] };
    let bodyText = rawMdText;

    if (match) {
        bodyText = rawMdText.replace(match[0], ""); // 切除元数据头部，保留纯正文
        const yamlLines = match[1].split("\n");
        yamlLines.forEach(line => {
            const parts = line.split(":");
            if (parts.length >= 2) {
                const key = parts[0].trim();
                let value = parts.slice(1).join(":").trim();
                
                if (key === "title") meta.title = value.replace(/^['"]|['"]$/g, "");
                if (key === "description") meta.description = value.replace(/^['"]|['"]$/g, "");
                if (key === "tags") {
                    // 解析标签数组 [随笔, 前端]
                    meta.tags = value.replace(/[\[\]]/g, "").split(",").map(t => t.trim()).filter(t => t);
                }
            }
        });
    }
    return { meta, bodyText };
}

// ==================== 3. 自动读取并建立检索库 ====================
async function fetchAndParsePosts() {
    const postsListContainer = document.getElementById("posts-list");
    const apiUrl = `https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/contents/${CONFIG.folder}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("读取云端文章目录失败，请检查公开仓库设置");
        
        const files = await response.json();
        const mdFiles = files.filter(file => file.name.endsWith('.md'));

        if (mdFiles.length === 0) {
            postsListContainer.innerHTML = '<div class="loading">posts/ 目录下尚未投放文章哦 🌟</div>';
            return;
        }

        // 并发请求所有文章的原始内容，用于建立本地全文搜索索引
        const loadPromises = mdFiles.map(async (file) => {
            const rawTitle = file.name.replace(".md", "");
            try {
                const res = await fetch(file.download_url);
                const rawText = await res.text();
                const { meta, bodyText } = parseFrontMatter(rawText, rawTitle);
                return {
                    downloadUrl: file.download_url,
                    filename: file.name,
                    title: meta.title,
                    description: meta.description,
                    tags: meta.tags,
                    bodyText: bodyText // 用于正文搜索
                };
            } catch (e) {
                return { downloadUrl: file.download_url, filename: file.name, title: rawTitle, description: "文章加载失败", tags: [], bodyText: "" };
            }
        });

        ALL_POSTS_CACHE = await Promise.all(loadPromises);
        renderPostsGrid(ALL_POSTS_CACHE); // 初次渲染

    } catch (error) {
        console.error(error);
        postsListContainer.innerHTML = `<div class="loading" style="color:#ef4444;">动态解析出错: ${error.message}</div>`;
    }
}

// 渲染网格视图
function renderPostsGrid(postsArray) {
    const postsListContainer = document.getElementById("posts-list");
    postsListContainer.innerHTML = "";

    if (postsArray.length === 0) {
        postsListContainer.innerHTML = '<div class="loading">没有找到匹配的文章 🔍</div>';
        return;
    }

    postsArray.forEach(post => {
        const card = document.createElement("div");
        card.className = "post-card";
        card.onclick = () => loadPostContent(post.downloadUrl, post.title);

        let tagsHtml = post.tags.map(tag => `<span class="tag-badge">${tag}</span>`).join("");

        card.innerHTML = `
            <h2 class="post-title">${post.title}</h2>
            <p class="post-description">${post.description}</p>
            <div class="post-tags">${tagsHtml}</div>
        `;
        postsListContainer.appendChild(card);
    });
}

// ==================== 4. 即时搜索引擎逻辑 ====================
function initSearchEngine() {
    const searchInput = document.getElementById("search-input");
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (!query) {
            renderPostsGrid(ALL_POSTS_CACHE);
            return;
        }

        // 对 标题、简介、正文、标签 进行多维全文本穿透匹配
        const filtered = ALL_POSTS_CACHE.filter(post => {
            const matchTitle = post.title.toLowerCase().includes(query);
            const matchDesc = post.description.toLowerCase().includes(query);
            const matchBody = post.bodyText.toLowerCase().includes(query);
            const matchTags = post.tags.some(tag => tag.toLowerCase().includes(query));
            return matchTitle || matchDesc || matchBody || matchTags;
        });

        renderPostsGrid(filtered);
    });
}

// ==================== 5. 文章装载页与路由 ====================
async function loadPostContent(downloadUrl, currentTitle) {
    const postsView = document.getElementById("posts-view");
    const contentView = document.getElementById("content-view");
    const articleDetail = document.getElementById("article-detail");

    try {
        const response = await fetch(downloadUrl);
        const rawText = await response.text();
        const { meta, bodyText } = parseFrontMatter(rawText, currentTitle);

        postsView.classList.add("hidden");
        contentView.classList.remove("hidden");

        // 渲染文章：头部元数据区 + 正文 Markdown
        articleDetail.innerHTML = `
            <h1>${meta.title}</h1>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 20px;">${meta.description}</p>
            <hr style="margin:25px 0; border:0; border-top:1px solid var(--glass-border);">
        ` + marked.parse(bodyText);
        
        window.location.hash = encodeURIComponent(meta.title);
        window.scrollTo(0, 0);
    } catch (error) {
        alert("文章获取失败");
    }
}

function routeToHome() {
    document.getElementById("posts-view").classList.remove("hidden");
    document.getElementById("content-view").classList.add("hidden");
    window.location.hash = "";
}

window.addEventListener("hashchange", () => {
    if (!window.location.hash) routeToHome();
});

// ==================== 6. 彩虹流光 Canvas 动力学引擎 ====================
function initRainbowCanvas() {
    const canvas = document.getElementById("bg-canvas");
    const ctx = canvas.getContext("2d");
    let width = (canvas.width = window.innerWidth), height = (canvas.height = window.innerHeight);

    window.addEventListener("resize", () => { width = (canvas.width = window.innerWidth); height = (canvas.height = window.innerHeight); });

    const blobs = [
        { x: width * 0.2, y: height * 0.2, r: 350, color: "rgba(255, 0, 128, 0.45)", vx: 0.9, vy: 1.1 },
        { x: width * 0.8, y: height * 0.3, r: 450, color: "rgba(128, 0, 255, 0.38)", vx: -0.7, vy: 0.9 },
        { x: width * 0.5, y: height * 0.7, r: 380, color: "rgba(0, 191, 255, 0.45)", vx: 1, vy: -0.6 },
        { x: width * 0.3, y: height * 0.8, r: 300, color: "rgba(0, 255, 128, 0.3)", vx: -0.4, vy: -0.8 }
    ];

    const mouseBlob = { x: width / 2, y: height / 2, targetX: width / 2, targetY: height / 2, r: 420, color: "rgba(255, 150, 0, 0.45)" };
    window.addEventListener("mousemove", (e) => { mouseBlob.targetX = e.clientX; mouseBlob.targetY = e.clientY; });

    function animate() {
        const isDark = document.body.classList.contains("dark-mode");
        ctx.fillStyle = isDark ? "#0a0714" : "#f1f5f9"; 
        ctx.fillRect(0, 0, width, height);

        blobs.forEach(blob => {
            blob.x += blob.vx; blob.y += blob.vy;
            if (blob.x < 0 || blob.x > width) blob.vx *= -1;
            if (blob.y < 0 || blob.y > height) blob.vy *= -1;

            const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
            grad.addColorStop(0, blob.color);
            grad.addColorStop(1, isDark ? "rgba(10, 7, 20, 0)" : "rgba(241, 245, 249, 0)");
            ctx.beginPath(); ctx.fillStyle = grad; ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2); ctx.fill();
        });

        mouseBlob.x += (mouseBlob.targetX - mouseBlob.x) * 0.08;
        mouseBlob.y += (mouseBlob.targetY - mouseBlob.y) * 0.08;

        const mouseGrad = ctx.createRadialGradient(mouseBlob.x, mouseBlob.y, 0, mouseBlob.x, mouseBlob.y, mouseBlob.r);
        mouseGrad.addColorStop(0, mouseBlob.color);
        mouseGrad.addColorStop(0.4, "rgba(236, 72, 153, 0.22)");
        mouseGrad.addColorStop(1, isDark ? "rgba(10, 7, 20, 0)" : "rgba(241, 245, 249, 0)");

        ctx.beginPath(); ctx.fillStyle = mouseGrad; ctx.arc(mouseBlob.x, mouseBlob.y, mouseBlob.r, 0, Math.PI * 2); ctx.fill();
        requestAnimationFrame(animate);
    }
    animate();
}