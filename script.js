const CONFIG = {
    username: "yunshuifuyao-ship-it", // 你的GitHub用户名
    repo: "my-blog",                  // 你的仓库名
    folder: "posts"                   // 投放文章的文件夹
};

document.addEventListener("DOMContentLoaded", () => {
    initRainbowCanvas(); // 初始化彩虹背景
    fetchPostsList();    // 自动抓取文章
});

// 1. 核心：动态模糊 + 跟随鼠标的彩虹流光渲染
function initRainbowCanvas() {
    const canvas = document.getElementById("bg-canvas");
    const ctx = canvas.getContext("2d");

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener("resize", () => {
        width = (canvas.width = window.innerWidth);
        height = (canvas.height = window.innerHeight);
    });

    // 几组基础色彩控制点（模拟环境流光）
    const blobs = [
        { x: width * 0.2, y: height * 0.2, r: 350, color: "rgba(255, 0, 128, 0.6)", vx: 1, vy: 1.2 },
        { x: width * 0.8, y: height * 0.3, r: 450, color: "rgba(128, 0, 255, 0.5)", vx: -0.8, vy: 1 },
        { x: width * 0.5, y: height * 0.7, r: 380, color: "rgba(0, 191, 255, 0.6)", vx: 1.1, vy: -0.7 },
        { x: width * 0.3, y: height * 0.8, r: 300, color: "rgba(0, 255, 128, 0.4)", vx: -0.5, vy: -0.9 }
    ];

    // 鼠标交互控制点
    const mouseBlob = { 
        x: width / 2, 
        y: height / 2, 
        targetX: width / 2, 
        targetY: height / 2, 
        r: 400, 
        color: "rgba(255, 165, 0, 0.55)" 
    };

    // 全局监听鼠标移动
    window.addEventListener("mousemove", (e) => {
        mouseBlob.targetX = e.clientX;
        mouseBlob.targetY = e.clientY;
    });

    function animate() {
        ctx.fillStyle = "#0f0c1b"; // 使用深色背景作为流光的底色
        ctx.fillRect(0, 0, width, height);

        // 渲染基础漂移彩虹色块
        blobs.forEach(blob => {
            blob.x += blob.vx;
            blob.y += blob.vy;

            if (blob.x < 0 || blob.x > width) blob.vx *= -1;
            if (blob.y < 0 || blob.y > height) blob.vy *= -1;

            const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
            grad.addColorStop(0, blob.color);
            grad.addColorStop(1, "rgba(15, 12, 27, 0)");

            ctx.beginPath();
            ctx.fillStyle = grad;
            ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // 渲染跟随鼠标的渐变色块（加入 0.08 的弹性缓动，让滑动更丝滑）
        mouseBlob.x += (mouseBlob.targetX - mouseBlob.x) * 0.08;
        mouseBlob.y += (mouseBlob.targetY - mouseBlob.y) * 0.08;

        const mouseGrad = ctx.createRadialGradient(mouseBlob.x, mouseBlob.y, 0, mouseBlob.x, mouseBlob.y, mouseBlob.r);
        mouseGrad.addColorStop(0, mouseBlob.color);
        mouseGrad.addColorStop(0.5, "rgba(255, 0, 255, 0.3)"); // 渐变混色
        mouseGrad.addColorStop(1, "rgba(15, 12, 27, 0)");

        ctx.beginPath();
        ctx.fillStyle = mouseGrad;
        ctx.arc(mouseBlob.x, mouseBlob.y, mouseBlob.r, 0, Math.PI * 2);
        ctx.fill();

        requestAnimationFrame(animate);
    }

    animate();
}

// 2. 自动读取 GitHub 目录下的文章
async function fetchPostsList() {
    const postsListContainer = document.getElementById("posts-list");
    const apiUrl = `https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/contents/${CONFIG.folder}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("无法获取文章列表，请检查配置或路径");
        
        const files = await response.json();
        const mdFiles = files.filter(file => file.name.endsWith('.md'));

        if (mdFiles.length === 0) {
            postsListContainer.innerHTML = '<div class="loading">posts 文件夹里空空如也，快去投放新文章吧~</div>';
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
                <div class="post-meta">✨ 智能投放文档</div>
            `;
            postsListContainer.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        postsListContainer.innerHTML = `<div class="loading" style="color:#ff4d4d;">加载失败: ${error.message}</div>`;
    }
}

// 3. 加载文章并解析 Markdown
async function loadPost(downloadUrl, title) {
    const postsView = document.getElementById("posts-view");
    const contentView = document.getElementById("content-view");
    const articleDetail = document.getElementById("article-detail");

    try {
        const response = await fetch(downloadUrl);
        const mdText = await response.text();

        postsView.classList.add("hidden");
        contentView.classList.remove("hidden");

        // 渲染正文
        articleDetail.innerHTML = `<h1>${title}</h1><hr style="margin:25px 0; border:0; border-top:1px solid rgba(0,0,0,0.08);">` + marked.parse(mdText);
        
        window.location.hash = encodeURIComponent(title);
        window.scrollTo(0, 0);
    } catch (error) {
        alert("文章加载失败");
    }
}

// 4. 路由回到主页
function routeToHome() {
    document.getElementById("posts-view").classList.remove("hidden");
    document.getElementById("content-view").classList.add("hidden");
    window.location.hash = "";
}

window.addEventListener("hashchange", () => {
    if (!window.location.hash) routeToHome();
});