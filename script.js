const CONFIG = {
    username: "yunshuifuyao-ship-it",
    repo: "my-blog",
    folder: "posts"
};

document.addEventListener("DOMContentLoaded", () => {
    initTheme();          // 1. 初始化深浅色系统
    initRainbowCanvas();   // 2. 注入动态鼠标彩虹
    fetchPostsList();      // 3. 自动同步文章
});

// ==================== 1. 深浅色模式智能管理 ====================
function initTheme() {
    const themeBtn = document.getElementById("theme-toggle");
    const body = document.body;

    // 优先读取本地存储，如果没有则默认深色模式
    const savedTheme = localStorage.getItem("blog-theme") || "dark-mode";
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
}

// ==================== 2. 全动态模糊彩虹背景 (跟随鼠标) ====================
function initRainbowCanvas() {
    const canvas = document.getElementById("bg-canvas");
    const ctx = canvas.getContext("2d");

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener("resize", () => {
        width = (canvas.width = window.innerWidth);
        height = (canvas.height = window.innerHeight);
    });

    // 4组基础环境漂移色彩块
    const blobs = [
        { x: width * 0.2, y: height * 0.2, r: 350, color: "rgba(255, 0, 128, 0.5)", vx: 0.9, vy: 1.1 },
        { x: width * 0.8, y: height * 0.3, r: 450, color: "rgba(128, 0, 255, 0.42)", vx: -0.7, vy: 0.9 },
        { x: width * 0.5, y: height * 0.7, r: 380, color: "rgba(0, 191, 255, 0.5)", vx: 1, vy: -0.6 },
        { x: width * 0.3, y: height * 0.8, r: 300, color: "rgba(0, 255, 128, 0.35)", vx: -0.4, vy: -0.8 }
    ];

    // 交互鼠标控制块
    const mouseBlob = { 
        x: width / 2, 
        y: height / 2, 
        targetX: width / 2, 
        targetY: height / 2, 
        r: 420, 
        color: "rgba(255, 150, 0, 0.5)" 
    };

    window.addEventListener("mousemove", (e) => {
        mouseBlob.targetX = e.clientX;
        mouseBlob.targetY = e.clientY;
    });

    function animate() {
        // 动态读取当前页面的底色用于画布清空，保证色彩对比纯净
        const isDark = document.body.classList.contains("dark-mode");
        ctx.fillStyle = isDark ? "#0a0714" : "#f1f5f9"; 
        ctx.fillRect(0, 0, width, height);

        // 渲染环境漂移块
        blobs.forEach(blob => {
            blob.x += blob.vx;
            blob.y += blob.vy;

            if (blob.x < 0 || blob.x > width) blob.vx *= -1;
            if (blob.y < 0 || blob.y > height) blob.vy *= -1;

            const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
            grad.addColorStop(0, blob.color);
            grad.addColorStop(1, isDark ? "rgba(10, 7, 20, 0)" : "rgba(241, 245, 249, 0)");

            ctx.beginPath();
            ctx.fillStyle = grad;
            ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // 智能缓动跟随鼠标
        mouseBlob.x += (mouseBlob.targetX - mouseBlob.x) * 0.08;
        mouseBlob.y += (mouseBlob.targetY - mouseBlob.y) * 0.08;

        const mouseGrad = ctx.createRadialGradient(mouseBlob.x, mouseBlob.y, 0, mouseBlob.x, mouseBlob.y, mouseBlob.r);
        mouseGrad.addColorStop(0, mouseBlob.color);
        mouseGrad.addColorStop(0.4, "rgba(236, 72, 153, 0.25)");
        mouseGrad.addColorStop(1, isDark ? "rgba(10, 7, 20, 0)" : "rgba(241, 245, 249, 0)");

        ctx.beginPath();
        ctx.fillStyle = mouseGrad;
        ctx.arc(mouseBlob.x, mouseBlob.y, mouseBlob.r, 0, Math.PI * 2);
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
}

// ==================== 3. 自动读取与解析文章列表 ====================
async function fetchPostsList() {
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

        postsListContainer.innerHTML = ""; 

        mdFiles.forEach(file => {
            const title = file.name.replace(".md", "");
            const card = document.createElement("div");
            card.className = "post-card";
            card.onclick = () => loadPost(file.download_url, title);

            card.innerHTML = `
                <h2 class="post-title">${title}</h2>
                <div class="post-meta">✨ 自动化动态挂载</div>
            `;
            postsListContainer.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        postsListContainer.innerHTML = `<div class="loading" style="color:#ef4444;">动态解析出错: ${error.message}</div>`;
    }
}

// 加载正文
async function loadPost(downloadUrl, title) {
    const postsView = document.getElementById("posts-view");
    const contentView = document.getElementById("content-view");
    const articleDetail = document.getElementById("article-detail");

    try {
        const response = await fetch(downloadUrl);
        const mdText = await response.text();

        postsView.classList.add("hidden");
        contentView.classList.remove("hidden");

        articleDetail.innerHTML = `<h1>${title}</h1><hr style="margin:25px 0; border:0; border-top:1px solid var(--glass-border);">` + marked.parse(mdText);
        
        window.location.hash = encodeURIComponent(title);
        window.scrollTo(0, 0);
    } catch (error) {
        alert("文章获取失败，请稍后重试");
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