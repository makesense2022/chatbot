// 简单的Node.js代理服务器，解决CORS问题
import express from "express";
import cors from "cors";
import axios from "axios";
// 添加cheerio用于解析HTML
import * as cheerio from "cheerio";
// 导入iconv-lite处理编码问题
import iconv from "iconv-lite";

const app = express();
const PORT = process.env.PORT || 3001;

// 启用所有CORS请求
app.use(cors());

// 启用JSON解析，确保使用UTF-8编码
app.use(
  express.json({
    limit: "10mb",
    type: "application/json",
    charset: "utf-8",
  })
);

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 设置全局响应编码
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

// 搜索结果项类型定义
class SearchItem {
  constructor(title, url, content) {
    this.title = title;
    this.url = url;
    this.content = content;
  }
}

// 定义搜索引擎基类
class SearchEngine {
  constructor(name) {
    this.name = name;
  }

  async search(query, numResults) {
    throw new Error("Method not implemented");
  }
}

// 添加HTML内容爬取和提取函数
async function fetchAndExtractContent(url, maxContentLength = 3000) {
  try {
    console.log(`正在爬取链接内容: ${url}`);
    const response = await axios.get(url, {
      timeout: 20000, // 增加超时时间
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      responseType: "arraybuffer", // 使用arraybuffer处理可能的编码问题
      maxRedirects: 5, // 允许最多5次重定向
    });

    // 检测编码并解码内容
    let html;
    const contentType = response.headers["content-type"] || "";
    let charset = "utf-8";

    if (contentType.includes("charset=")) {
      charset = contentType.split("charset=")[1].split(";")[0].trim();
    } else {
      // 尝试从HTML内容检测编码
      const bufferString = Buffer.from(response.data).toString();
      const charsetMatch = bufferString.match(
        /<meta[^>]*charset=["']?([^"' >]+)/i
      );
      if (charsetMatch && charsetMatch[1]) {
        charset = charsetMatch[1];
      }
    }

    try {
      html = iconv.decode(Buffer.from(response.data), charset);
    } catch (e) {
      console.warn(`使用${charset}解码失败，尝试使用utf-8: ${e.message}`);
      html = Buffer.from(response.data).toString("utf-8");
    }

    // 使用cheerio解析HTML
    const $ = cheerio.load(html);

    // 移除不需要的元素
    $(
      "script, style, nav, footer, header, .header, .footer, .nav, .menu, .sidebar, .ad, .advertisement, iframe, .comment, .comments, .social, .share, .related, aside"
    ).remove();

    // 提取主要内容
    let mainContent = "";
    let articleTitle = $("title").text().trim();

    // 针对新闻网站的特殊处理
    const isNewsPage = /news|article|post|blog|新闻|资讯|报道/.test(url);

    if (isNewsPage) {
      // 优先查找新闻内容容器
      const newsContentSelectors = [
        "article",
        ".article",
        ".article-content",
        ".article-body",
        ".story-body",
        ".news-content",
        ".news-text",
        ".content-detail",
        ".story-content",
        ".post-content",
        ".entry-content",
        ".main-content",
        "#article-content",
        ".text-content",
        ".detail",
        ".detailContent",
        ".content-wrapper",
      ];

      for (const selector of newsContentSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          // 提取段落
          let paragraphs = [];
          element.find("p").each((i, p) => {
            const text = $(p).text().trim();
            if (text.length > 10) {
              // 忽略过短的段落
              paragraphs.push(text);
            }
          });

          if (paragraphs.length > 0) {
            mainContent = paragraphs.join("\n\n");
            break;
          } else {
            // 如果没有找到段落，使用容器内所有文本
            mainContent = element
              .text()
              .trim()
              .replace(/\s+/g, " ")
              .replace(/\n+/g, "\n\n")
              .trim();
          }
        }
      }
    }

    // 如果未找到特定的新闻内容，尝试常规内容选择器
    if (!mainContent || mainContent.length < 100) {
      // 寻找可能的主要内容容器
      const contentSelectors = [
        "article",
        ".article",
        ".content",
        ".main",
        ".post",
        ".entry",
        ".entry-content",
        "#content",
        "#main",
        "#article",
        ".body",
        ".post-content",
        ".article-content",
        "main",
        '[role="main"]',
        ".text",
        ".container",
        ".page-content",
        ".page",
        ".news",
        ".story",
      ];

      // 尝试各种可能的内容选择器
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          // 提取文本并清理
          const text = element
            .text()
            .trim()
            .replace(/\s+/g, " ")
            .replace(/\n+/g, "\n\n")
            .trim();

          if (text.length > mainContent.length) {
            mainContent = text;
          }
        }
      }
    }

    // 如果仍然没有找到主要内容，则提取body所有文本
    if (!mainContent || mainContent.length < 100) {
      mainContent = $("body")
        .text()
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\n+/g, "\n\n")
        .trim();
    }

    // 尝试提取更具体的标题
    const h1 = $("h1").first().text().trim();
    if (h1 && h1.length > 5 && h1.length < 100) {
      articleTitle = h1;
    }

    // 提取发布日期（如果有）
    let publishDate = "";
    // 尝试从meta标签获取日期
    const metaDate = $(
      'meta[property="article:published_time"], meta[name="pubdate"], meta[name="publishdate"], meta[itemprop="datePublished"]'
    ).attr("content");
    if (metaDate) {
      publishDate = metaDate;
    } else {
      // 尝试从常见的日期容器中获取
      const dateSelectors = [
        ".date",
        ".time",
        ".publish-date",
        ".publish-time",
        ".article-date",
        ".article-time",
        ".post-date",
        ".post-time",
        ".entry-date",
        ".timestamp",
        '[itemprop="datePublished"]',
        ".news-date",
        ".news-time",
      ];

      for (const selector of dateSelectors) {
        const dateText = $(selector).first().text().trim();
        if (
          dateText &&
          /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/.test(
            dateText
          )
        ) {
          publishDate = dateText;
          break;
        }
      }
    }

    // 限制内容长度
    if (mainContent.length > maxContentLength) {
      mainContent = mainContent.substring(0, maxContentLength) + "...";
    }

    console.log(
      `成功提取内容，长度: ${mainContent.length} 字符，标题: ${articleTitle}`
    );
    return {
      url,
      title: articleTitle,
      content: mainContent,
      publishDate,
      success: true,
    };
  } catch (error) {
    console.error(`爬取链接失败 ${url}:`, error.message);
    return {
      url,
      title: "无法访问此链接",
      content: `爬取失败: ${error.message}`,
      success: false,
    };
  }
}

// Serper.dev API 实现
class SerperEngine extends SearchEngine {
  constructor() {
    super("serper");
    this.userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
  }

  async search(query, numResults = 10, fetchContent = false) {
    try {
      // 使用预设的API密钥
      const apiKey = "a0522c77dfe9999b47c8ab90bdca6d1702c2f8c5";
      console.log(`使用Serper搜索: "${query}"`);

      // 修改为使用search端点
      const endpoint = "https://google.serper.dev/search";

      console.log(`使用Serper搜索端点: ${endpoint}`);

      const response = await axios.post(
        endpoint,
        {
          q: query,
          num: numResults,
          gl: "cn", // 添加地区参数，针对中文搜索
          hl: "zh-cn", // 添加语言参数，针对中文搜索
          tbs: "qdr:w", // 限制为最近一周的结果
        },
        {
          headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
            "User-Agent": this.userAgent,
          },
          timeout: 10000,
        }
      );

      const results = [];

      // 处理通用搜索结果
      if (response.data.organic) {
        console.log(
          `获取到${response.data.organic.length}条普通搜索结果，准备处理`
        );

        for (const item of response.data.organic) {
          // 创建基本搜索结果并确保link字段映射到url属性
          const searchItem = new SearchItem(
            item.title,
            item.link,
            item.snippet || "No description available"
          );

          // 将搜索结果添加到结果数组
          results.push(searchItem);
          if (results.length >= numResults) break;
        }
      }

      // 如果需要爬取内容，使用并发方式处理所有链接
      if (fetchContent && results.length > 0) {
        console.log(`开始并发爬取 ${results.length} 条内容...`);
        const startTime = Date.now();

        // 创建爬取任务数组
        const fetchTasks = results.map(async (item) => {
          if (!item.url) return;

          try {
            console.log(`并发爬取链接内容: ${item.url}`);
            const contentResult = await fetchAndExtractContent(item.url);

            if (
              contentResult.success &&
              contentResult.content.length > item.content.length * 1.5
            ) {
              // 仅当爬取内容明显比snippet更丰富时更新
              item.content = contentResult.content;
              item.fullContent = true;
              if (contentResult.publishDate) {
                item.publishDate = contentResult.publishDate;
              }
              console.log(
                `成功爬取内容: ${item.url}, 长度: ${item.content.length}`
              );
            }
          } catch (fetchError) {
            console.error(`爬取失败: ${item.url} - ${fetchError.message}`);
          }
        });

        // 等待所有爬取任务完成
        await Promise.all(fetchTasks);

        const endTime = Date.now();
        console.log(`并发爬取完成，耗时: ${(endTime - startTime) / 1000}秒`);
      }

      console.log(`Serper搜索成功, 返回 ${results.length} 条结果`);
      return results;
    } catch (error) {
      console.error("Serper search error:", error.message);
      return [];
    }
  }
}

// SerpAPI搜索引擎实现
class SerpApiEngine extends SearchEngine {
  constructor() {
    super("serpapi");
    this.userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
  }

  async search(query, numResults = 10, fetchContent = false) {
    try {
      // 使用预设的API密钥
      const apiKey =
        "007cb1a410f9898649bf019e8682ec85547b6f3b89aa724a1c02faa81dd68c9a";
      console.log(`使用SerpAPI搜索: "${query}"`);

      const response = await axios.get("https://serpapi.com/search", {
        params: {
          q: query,
          api_key: apiKey,
          num: numResults,
          hl: "zh-cn", // 添加语言参数，针对中文搜索
          gl: "cn", // 添加地区参数，针对中文搜索
          tbm: "nws", // 优先获取新闻结果
        },
        timeout: 10000,
        headers: {
          "User-Agent": this.userAgent,
        },
      });

      const results = [];

      // 处理有机搜索结果
      if (response.data.organic_results) {
        console.log(
          `获取到${response.data.organic_results.length}条搜索结果，准备处理`
        );

        for (const item of response.data.organic_results) {
          if (results.length >= numResults) break;

          // 创建基本搜索结果
          const searchItem = new SearchItem(
            item.title,
            item.link,
            item.snippet || "No description available"
          );

          // 将搜索结果添加到结果数组
          results.push(searchItem);
        }
      }

      // 处理新闻结果（如果有）
      if (response.data.news_results) {
        console.log(
          `获取到${response.data.news_results.length}条新闻结果，准备处理`
        );

        for (const item of response.data.news_results) {
          if (results.length >= numResults) break;

          // 创建基本搜索结果
          const searchItem = new SearchItem(
            item.title,
            item.link,
            item.snippet || "No description available"
          );

          // 添加额外的新闻信息
          searchItem.source = item.source || "";
          searchItem.date = item.date || "";
          searchItem.thumbnail = item.thumbnail || "";
          searchItem.hasExtraInfo = true;

          // 将搜索结果添加到结果数组
          results.push(searchItem);
        }
      }

      // 如果需要爬取内容，使用并发方式处理所有链接
      if (fetchContent && results.length > 0) {
        console.log(`开始并发爬取 ${results.length} 条内容...`);
        const startTime = Date.now();

        // 创建爬取任务数组
        const fetchTasks = results.map(async (item) => {
          if (!item.url) return;

          try {
            console.log(`并发爬取链接内容: ${item.url}`);
            const contentResult = await fetchAndExtractContent(item.url);

            if (
              contentResult.success &&
              contentResult.content.length > item.content.length * 1.5
            ) {
              // 仅当爬取内容明显比snippet更丰富时更新
              item.content = contentResult.content;
              item.fullContent = true;
              if (contentResult.publishDate) {
                item.publishDate = contentResult.publishDate;
              }
              console.log(
                `成功爬取内容: ${item.url}, 长度: ${item.content.length}`
              );
            }
          } catch (fetchError) {
            console.error(`爬取失败: ${item.url} - ${fetchError.message}`);
          }
        });

        // 等待所有爬取任务完成
        await Promise.all(fetchTasks);

        const endTime = Date.now();
        console.log(`并发爬取完成，耗时: ${(endTime - startTime) / 1000}秒`);
      }

      console.log(`SerpAPI搜索成功, 返回 ${results.length} 条结果`);
      return results;
    } catch (error) {
      console.error("SerpAPI search error:", error.message);
      return [];
    }
  }
}

// Web搜索工具类
class WebSearchTool {
  constructor() {
    // 初始化所有搜索引擎
    this.engines = {
      serper: new SerperEngine(),
      serpapi: new SerpApiEngine(),
    };
  }

  // 获取引擎优先顺序
  getEngineOrder() {
    // 默认顺序：从最稳定到最不稳定
    return ["serper", "serpapi"];
  }

  // 尝试所有搜索引擎
  async tryAllEngines(query, numResults, fetchContent = true) {
    const engineOrder = this.getEngineOrder();

    for (const engineName of engineOrder) {
      try {
        const engine = this.engines[engineName];
        console.log(`尝试搜索引擎: ${engineName}`);

        // 所有引擎现在都支持fetchContent参数
        const results = await engine.search(query, numResults, fetchContent);

        if (results && results.length > 0) {
          console.log(`${engineName}引擎成功返回${results.length}条结果`);
          return results;
        }
      } catch (error) {
        console.error(`${engineName}搜索失败:`, error);
      }
    }

    // 如果所有引擎都失败，返回空数组
    console.log("所有搜索引擎都失败了");
    return [];
  }

  // 执行搜索
  async search(query, numResults = 10, engine = null, fetchContent = false) {
    try {
      let results;

      // 如果指定了搜索引擎，则使用指定引擎
      if (engine && this.engines[engine]) {
        console.log(`使用指定搜索引擎: ${engine}`);

        // 现在所有引擎都支持fetchContent参数
        results = await this.engines[engine].search(
          query,
          numResults,
          fetchContent
        );
      } else {
        // 否则尝试所有搜索引擎
        results = await this.tryAllEngines(query, numResults, fetchContent);
      }

      return results;
    } catch (error) {
      console.error("搜索过程出错:", error);
      return [];
    }
  }
}

// 创建搜索工具实例
const webSearchTool = new WebSearchTool();

// 搜索服务类
class SearchService {
  constructor(searchTool) {
    this.searchTool = searchTool;
  }

  /**
   * 执行搜索
   * @param {string} query - 搜索关键词
   * @param {string} engine - 可选的指定搜索引擎
   * @param {boolean} fetchContent - 是否爬取链接内容
   * @returns {Promise<SearchItem[]>} 搜索结果
   */
  async search(query, engine = null, fetchContent = false) {
    console.log(`搜索服务处理查询: "${query}", 爬取内容: ${fetchContent}`);

    try {
      // 执行搜索
      const searchResults = await this.searchTool.search(
        query,
        10,
        engine,
        fetchContent
      );

      if (searchResults && searchResults.length > 0) {
        console.log(`搜索成功返回 ${searchResults.length} 条结果`);
        return searchResults;
      }
    } catch (searchError) {
      console.error("搜索失败:", searchError);
    }

    // 如果所有搜索失败，直接返回基本结果
    return [
      new SearchItem(
        `关于"${query}"的搜索`,
        `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        `无法获取"${query}"的搜索结果。请尝试直接访问搜索引擎。`
      ),
    ];
  }

  /**
   * 格式化搜索结果为API响应格式
   * @param {SearchItem[]} results - 搜索结果
   * @param {string} query - 原始查询
   * @returns {Object} 格式化后的响应对象
   */
  formatResults(results, query) {
    // 确保不出现编码问题
    return {
      query,
      results: results.map((result) => {
        const formattedResult = {
          title: result.title,
          content: result.content,
          url: result.url,
          fullContent: result.fullContent || false,
        };

        // 添加新闻特有的信息（如果有）
        if (result.hasExtraInfo) {
          formattedResult.source = result.source;
          formattedResult.date = result.date || result.publishDate || "";
          formattedResult.imageUrl = result.imageUrl;
          formattedResult.isNews = true;
        }

        return formattedResult;
      }),
      meta: {
        engine: "WebSearchTool",
        timestamp: new Date().toISOString(),
        totalResults: results.length,
        // 添加特征信息，标记是否为新闻搜索
        isNewsSearch: results.some((r) => r.hasExtraInfo),
      },
    };
  }
}

// 创建搜索服务实例
const searchService = new SearchService(webSearchTool);

// API路由
// 搜索API
app.get("/api/search", async (req, res) => {
  try {
    // 获取查询参数，确保正确处理特殊字符
    const rawQuery = req.query.q;
    const engine = req.query.engine; // 可选参数，指定搜索引擎
    const fetchContent = req.query.fetch_content === "true"; // 是否爬取链接内容

    if (!rawQuery) {
      return res.status(400).json({ error: "缺少查询参数" });
    }

    // 确保正确解码查询参数
    const query = decodeURIComponent(rawQuery);
    console.log(`处理搜索查询: "${query}", 爬取内容: ${fetchContent}`);

    // 执行搜索
    const searchResults = await searchService.search(
      query,
      engine,
      fetchContent
    );

    // 格式化结果
    const formattedResults = searchService.formatResults(searchResults, query);

    // 设置响应头
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    // 使用Buffer处理中文编码问题
    const jsonString = JSON.stringify(formattedResults);
    const buffer = Buffer.from(jsonString, "utf8");
    return res.send(buffer);
  } catch (error) {
    console.error("搜索请求处理失败:", error);
    res.status(500).json({
      error: "搜索请求失败",
      details: error?.message || "未知错误",
    });
  }
});

// 获取可用搜索引擎列表
app.get("/api/engines", (req, res) => {
  try {
    const engines = Object.keys(webSearchTool.engines);
    res.json({
      engines,
      default_order: webSearchTool.getEngineOrder(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 测试端点
app.get("/test", (req, res) => {
  res.json({
    message: "测试端点正常",
    time: new Date().toISOString(),
  });
});

// 健康检查接口
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "代理服务器正常运行",
    time: new Date().toISOString(),
    mode: "多搜索引擎模式",
    engines: Object.keys(webSearchTool.engines),
  });
});

// 处理404错误
app.use((req, res) => {
  console.log(`404 - 未找到: ${req.method} ${req.url}`);
  res.status(404).json({ error: "未找到请求的资源" });
});

// 处理全局错误
app.use((err, req, res, next) => {
  console.error("服务器错误:", err);
  res.status(500).json({ error: "服务器内部错误", details: err?.message });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`代理服务器运行在端口 ${PORT} (多搜索引擎模式)`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`测试端点: http://localhost:${PORT}/test`);
  console.log(`搜索接口: http://localhost:${PORT}/api/search?q=新闻`);
  console.log(`引擎列表: http://localhost:${PORT}/api/engines`);
  console.log(
    `爬取内容: http://localhost:${PORT}/api/search?q=新闻&engine=serper&fetch_content=true`
  );
});

// 使用说明
console.log(`
======================================================
多搜索引擎代理服务器使用说明:

1. 安装依赖:
   npm install express cors axios cheerio iconv-lite

2. 启动服务器:
   node proxy-server.js

3. 测试服务器是否正常工作:
   - 访问健康检查: http://localhost:3001/health
   - 访问测试端点: http://localhost:3001/test
   - 尝试搜索: http://localhost:3001/api/search?q=新闻
   - 查看引擎列表: http://localhost:3001/api/engines
   - 指定引擎搜索: http://localhost:3001/api/search?q=新闻&engine=serper
   - 爬取链接内容: http://localhost:3001/api/search?q=新闻&engine=serper&fetch_content=true

4. API 参数说明:
   - q: 必填，搜索关键词
   - engine: 可选，指定搜索引擎，可选值：serper, serpapi
   - fetch_content: 可选，是否爬取搜索结果链接的详细内容，值为 true 时启用

5. 在前端代码中使用以下URL:
   http://localhost:3001/api/search?q=YOUR_QUERY

注意: 此版本服务器集成了多个搜索引擎:
      - SerperEngine (使用google.serper.dev/search API)
      - SerpApiEngine (使用serpapi.com/search API)

      所有引擎都支持爬取搜索结果链接的详细内容，提供更丰富的信息
======================================================
`);
