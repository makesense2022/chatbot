import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, ChevronDown, ChevronUp, RefreshCw, Plus, Trash2, Menu, X, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
}

// 定义聊天记录接口
interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface DeepseekModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

// 定义搜索结果接口
interface SearchResult {
  title: string;
  content: string;
  url: string;
  fullContent?: boolean;
  source?: string;
  date?: string;
  imageUrl?: string;
  isNews?: boolean;
}

// 定义搜索响应接口
interface SearchResponse {
  query: string;
  results: SearchResult[];
  meta: {
    engine: string;
    timestamp: string;
    totalResults: number;
    isNewsSearch?: boolean;
  };
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: '你是一个知识问答助手。请尽可能回答用户的问题。如果你不确定答案，请诚实地说你不知道。'
    }
  ]);
  // 添加历史会话管理状态
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [availableModels, setAvailableModels] = useState<DeepseekModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  // 添加用户滚动状态，追踪用户是否在主动滚动
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  
  // 添加思考内容折叠状态管理
  const [collapsedThinking, setCollapsedThinking] = useState<Record<number, boolean>>({});
  
  // 切换思考内容的折叠状态
  const toggleThinking = (index: number) => {
    setCollapsedThinking(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // 添加搜索模式状态
  const [isSearchMode, setIsSearchMode] = useState(false);

  const scrollToBottom = () => {
    // 只有当自动滚动启用时才滚动到底部
    if (autoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 处理滚动事件
  const handleScroll = () => {
    if (!messageContainerRef.current || !isStreaming) return;

    const { scrollTop, scrollHeight, clientHeight } = messageContainerRef.current;
    // 计算距离底部的距离
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // 如果用户向上滚动超过100px，则认为是主动查看历史消息
    if (distanceFromBottom > 100) {
      setUserHasScrolled(true);
      setAutoScrollEnabled(false);
    } else {
      setUserHasScrolled(false);
      setAutoScrollEnabled(true);
    }
  };

  // 添加滚动事件监听
  useEffect(() => {
    const messageContainer = messageContainerRef.current;
    if (messageContainer) {
      messageContainer.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (messageContainer) {
        messageContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isStreaming]);

  // 消息更新时处理滚动
  useEffect(() => {
    // 如果不是在流式输出，或者用户没有手动滚动，则滚动到底部
    if (!isStreaming || !userHasScrolled) {
      scrollToBottom();
    }
  }, [messages, isStreaming, userHasScrolled]);

  // 当流式输出结束时重置滚动状态
  useEffect(() => {
    if (!isStreaming) {
      setUserHasScrolled(false);
      setAutoScrollEnabled(true);
      scrollToBottom();
    }
  }, [isStreaming]);

  // 会话管理功能
  // 从本地存储加载会话
  useEffect(() => {
    const savedSessions = localStorage.getItem('chatSessions');
    if (savedSessions) {
      try {
        const sessions = JSON.parse(savedSessions).map((session: ChatSession) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt)
        }));
        setChatSessions(sessions);
        
        // 如果有当前会话ID，载入该会话
        const lastSessionId = localStorage.getItem('currentSessionId');
        if (lastSessionId) {
          const foundSession = sessions.find((s: ChatSession) => s.id === lastSessionId);
          if (foundSession) {
            setCurrentSessionId(lastSessionId);
            setMessages(foundSession.messages);
          } else if (sessions.length > 0) {
            // 如果找不到上次的会话但有其他会话，载入最新的一个
            const latestSession = sessions.sort((a: ChatSession, b: ChatSession) => 
              b.updatedAt.getTime() - a.updatedAt.getTime()
            )[0];
            setCurrentSessionId(latestSession.id);
            setMessages(latestSession.messages);
          } else {
            // 如果没有会话，创建一个新的
            createNewChat();
          }
        } else if (sessions.length > 0) {
          // 如果没有lastSessionId但有会话，载入最新的
          const latestSession = sessions.sort((a: ChatSession, b: ChatSession) => 
            b.updatedAt.getTime() - a.updatedAt.getTime()
          )[0];
          setCurrentSessionId(latestSession.id);
          setMessages(latestSession.messages);
        } else {
          // 如果没有会话，创建一个新的
          createNewChat();
        }
      } catch (error) {
        console.error('加载会话失败:', error);
        createNewChat();
      }
    } else {
      // 如果没有保存的会话，创建一个新的
      createNewChat();
    }
  }, []);

  // 保存当前会话到本地存储
  useEffect(() => {
    if (currentSessionId && messages.length > 1) {
      // 更新当前会话
      setChatSessions(prev => {
        const updatedSessions = prev.map(session => {
          if (session.id === currentSessionId) {
            // 更新标题 - 从第一条用户消息获取
            const firstUserMessage = messages.find(m => m.role === 'user');
            const title = firstUserMessage 
              ? truncateTitle(firstUserMessage.content) 
              : '新对话';
            
            return {
              ...session,
              title,
              messages,
              updatedAt: new Date()
            };
          }
          return session;
        });
        
        // 保存到本地存储
        localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));
        localStorage.setItem('currentSessionId', currentSessionId);
        
        return updatedSessions;
      });
    }
  }, [messages, currentSessionId]);

  // 创建新的聊天会话
  const createNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: '新对话',
      messages: [
        {
          role: 'system',
          content: '你是一个知识问答助手。请尽可能回答用户的问题。如果你不确定答案，请诚实地说你不知道。'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setChatSessions(prev => {
      const updated = [...prev, newSession];
      localStorage.setItem('chatSessions', JSON.stringify(updated));
      return updated;
    });
    
    setCurrentSessionId(newId);
    setMessages(newSession.messages);
    setInput('');
  };

  // 切换到指定的聊天会话
  const switchToChat = (sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      localStorage.setItem('currentSessionId', sessionId);
    }
  };

  // 删除聊天会话
  const deleteChat = (sessionId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    setChatSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      localStorage.setItem('chatSessions', JSON.stringify(updated));
      
      // 如果删除的是当前会话，切换到最新的会话或创建一个新的
      if (sessionId === currentSessionId) {
        if (updated.length > 0) {
          const latest = updated.sort((a, b) => 
            b.updatedAt.getTime() - a.updatedAt.getTime()
          )[0];
          setCurrentSessionId(latest.id);
          setMessages(latest.messages);
          localStorage.setItem('currentSessionId', latest.id);
        } else {
          // 如果没有会话了，创建一个新的
          createNewChat();
        }
      }
      
      return updated;
    });
  };

  // 工具函数：截断标题
  const truncateTitle = (text: string, maxLength = 30) => {
    // 移除可能的"搜索新闻:"前缀
    const cleanText = text.replace(/^搜索新闻:\s*/, '');
    
    if (cleanText.length <= maxLength) return cleanText;
    return cleanText.substring(0, maxLength) + '...';
  };

  // 获取可用模型列表
  const fetchAvailableModels = async () => {
    setIsLoadingModels(true);
    try {
      const deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
      
      if (!deepseekApiKey) {
        throw new Error('缺少 Deepseek API 密钥配置');
      }
      
      const response = await fetch('https://api.deepseek.com/models', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${deepseekApiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }
      
      const data = await response.json();
      setAvailableModels(data.data || []);
    } catch (error) {
      console.error('获取模型列表失败:', error);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // 页面加载时获取模型列表
  useEffect(() => {
    fetchAvailableModels();
  }, []);

  // 搜索新闻内容
  const searchNews = async (query: string): Promise<SearchResult[]> => {
    // 搜索过程中的状态处理
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `http://localhost:3001/api/search?q=${encodedQuery}&engine=serper&fetch_content=true`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`搜索请求失败: ${response.status}`);
      }
      
      const data: SearchResponse = await response.json();
      return data.results;
    } catch (error) {
      console.error('搜索新闻失败:', error);
      return [];
    }
  };
  
  // 将搜索结果发送到大模型进行总结
  const summarizeNewsWithAI = async (newsContent: string): Promise<{summary: string, thinking?: string}> => {
    try {
      // 验证环境变量
      const deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

      if (!deepseekApiKey) {
        throw new Error('缺少 Deepseek API 密钥配置');
      }
      
      // 确保新闻内容不会被截断
      const fullContent = newsContent.length > 50000 
        ? `${newsContent.substring(0, 50000)}...\n\n[内容过长，已截断。请基于以上内容进行总结]` 
        : newsContent;
      
      console.log('发送到AI的新闻内容长度:', fullContent.length);
      
      // 判断是否使用思考模型
      const useReasonerModel = isReasonerModel(selectedModel);
      const modelToUse = useReasonerModel ? selectedModel : selectedModel;
      
      console.log(`使用模型: ${modelToUse}, 是否支持思考: ${useReasonerModel}`);
      
      let systemPrompt = '';
      
      // 根据模型类型设置不同的提示词
      if (useReasonerModel) {
        // 思考模型简洁提示词
        systemPrompt = '你是一个新闻总结助手。请总结以下新闻内容，提取重要信息，使用简明扼要的语言。总结要全面但精简。注意保留新闻中提到的关键数据、人物和事件。';
      } else {
        // 非思考模型使用标签格式
        systemPrompt = '你是一个新闻总结助手。请先思考新闻内容的主要事件、人物、背景和意义，然后再进行总结。在回答时，使用格式：\n\n<thinking>\n[你的分析思考过程，包括关键事实、数据、时间线等]\n</thinking>\n\n[最终总结，简明扼要，不要重复思考部分的内容]';
      }
      
      // 开启流式处理
      setIsStreaming(true);
      
      // 使用流式API
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { 
              role: 'system', 
              content: systemPrompt
            },
            { role: 'user', content: fullContent }
          ],
          temperature: 0.7,
          max_tokens: 8192,
          stream: true, // 启用流式响应
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '未知错误' }));
        throw new Error(errorData.error || `HTTP 错误! 状态码: ${response.status}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder('utf-8');
      let assistantResponse = '';
      let reasoningContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // 解析响应块
        const chunk = decoder.decode(value);
        const lines = chunk
          .split('\n')
          .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              // 处理常规内容
              if (data.choices && data.choices[0]?.delta?.content !== undefined) {
                const contentDelta = data.choices[0].delta.content || '';
                assistantResponse += contentDelta;
              }
              
              if (useReasonerModel) {
                // 处理思考内容 (reasoner模型)
                if (data.choices && data.choices[0]?.delta?.reasoning_content !== undefined) {
                  const reasoningDelta = data.choices[0].delta.reasoning_content || '';
                  reasoningContent += reasoningDelta;
                }
                
                // 更新最后一条消息的内容
                setMessages(prev => {
                  const newMessages = [...prev];
                  const responseContent = `
### 关于"${prev[prev.length - 2].content.replace(/搜索新闻: /, '')}"的新闻总结

${assistantResponse}
`;
                  
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: responseContent.trim(),
                    thinking: reasoningContent.trim() || undefined
                  };
                  return newMessages;
                });
              } else {
                // 非reasoner模型，尝试解析thinking标签
                setMessages(prev => {
                  const newMessages = [...prev];
                  
                  // 尝试解析思考标签
                  const thinkingMatch = assistantResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
                  let content = assistantResponse;
                  let thinking = undefined;
                  
                  if (thinkingMatch) {
                    thinking = thinkingMatch[1].trim();
                    content = assistantResponse.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '').trim();
                  }
                  
                  const responseContent = `
### 关于"${prev[prev.length - 2].content.replace(/搜索新闻: /, '')}"的新闻总结

${content}
`;
                  
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: responseContent.trim(),
                    thinking: thinking
                  };
                  
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('解析流数据时出错:', e);
              console.error('问题数据:', line);
            }
          }
        }
      }
      
      // 流式输出完成
      setIsStreaming(false);
      
      // 根据最终的结果提取思考内容和总结
      let finalSummary = assistantResponse;
      let finalThinking = undefined;
      
      if (useReasonerModel) {
        finalThinking = reasoningContent.trim() || undefined;
      } else {
        const thinkingMatch = assistantResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
        if (thinkingMatch) {
          finalThinking = thinkingMatch[1].trim();
          finalSummary = assistantResponse.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '').trim();
        }
      }
      
      return { 
        summary: finalSummary,
        thinking: finalThinking
      };
    } catch (error) {
      console.error('总结新闻失败:', error);
      setIsStreaming(false);
      return { 
        summary: `总结失败: ${error instanceof Error ? error.message : '未知错误'}` 
      };
    }
  };

  // 处理搜索并总结新闻
  const handleSearchAndSummarize = async (searchQuery: string) => {
    setIsLoading(true);
    
    // 如果没有当前会话ID或者没有会话，先创建一个新的
    if (!currentSessionId || chatSessions.length === 0) {
      createNewChat();
      // 由于createNewChat是异步更新状态，等待下一个渲染周期
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    try {
      // 添加用户搜索消息
      const userMessage: Message = { 
        role: 'user', 
        content: `搜索新闻: ${searchQuery}` 
      };
      setMessages(prev => [...prev, userMessage]);
      
      // 添加初始的空助手消息
      setMessages(prev => [...prev, { role: 'assistant', content: '正在搜索新闻...' }]);
      
      // 执行搜索
      const results = await searchNews(searchQuery);
      
      if (results.length === 0) {
        // 更新助手消息，通知未找到结果
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = `未找到关于"${searchQuery}"的新闻结果。`;
          return newMessages;
        });
        setIsLoading(false);
        return;
      }
      
      // 更新助手消息，表示正在处理
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].content = `找到 ${results.length} 条新闻结果，正在分析内容...`;
        return newMessages;
      });
      
      // 为了避免tokens超限，选择前5条新闻的完整内容进行分析
      const newsForAnalysis = results.slice(0, 10);
      
      // 构建要发送给大模型的内容
      let combinedContent = `以下是关于"${searchQuery}"的多条新闻内容，请综合分析并总结主要信息：\n\n`;
      
      newsForAnalysis.forEach((item, index) => {
        combinedContent += `===== 新闻 ${index + 1} =====\n`;
        combinedContent += `标题: ${item.title}\n`;
        combinedContent += `内容: ${item.content || '无详细内容'}\n`;
        combinedContent += `来源: ${item.source || '未知来源'}\n`;
        combinedContent += `日期: ${item.date || '未知日期'}\n\n`;
      });
      
      // 添加剩余新闻的标题
      if (results.length > 5) {
        combinedContent += "===== 其他相关新闻标题 =====\n";
        for (let i = 5; i < results.length; i++) {
          combinedContent += `${i+1}. ${results[i].title} (${results[i].source || '未知来源'}, ${results[i].date || '未知日期'})\n`;
        }
      }
      
      // 打印组合内容长度，用于调试
      console.log(`总共收集了 ${results.length} 条新闻，详细分析前10条`);
      console.log(`组合内容总长度: ${combinedContent.length}字符`);
      
      // 使用AI总结新闻内容（现在使用流式输出）
      await summarizeNewsWithAI(combinedContent);
      
      // 不需要额外设置消息，因为summarizeNewsWithAI函数已经在流式处理过程中更新了消息
      
    } catch (error) {
      console.error('处理搜索和总结失败:', error);
      // 更新助手消息，报告错误
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].content = `搜索或总结过程中出现错误: ${error instanceof Error ? error.message : '未知错误'}`;
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 判断模型是否支持思考功能
  const isReasonerModel = (modelId: string) => {
    return modelId.includes('reasoner');
  };

  // 修改表单提交处理函数，根据模式不同处理搜索或聊天
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // 如果没有当前会话ID或者没有会话，先创建一个新的
    if (!currentSessionId || chatSessions.length === 0) {
      createNewChat();
      // 由于createNewChat是异步更新状态，等待下一个渲染周期
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const inputQuery = input.trim();
    setInput('');
    
    if (isSearchMode) {
      // 搜索模式，直接进行网络搜索
      await handleSearchAndSummarize(inputQuery);
      return;
    }
    
    // 检查是否是搜索新闻的请求（保留原有的文本检测功能）
    const isNewsSearchQuery = /搜索新闻|查找新闻|新闻搜索|查询新闻|最新新闻|今日新闻|人工智能新闻|AI新闻/.test(inputQuery);
    
    if (isNewsSearchQuery) {
      // 处理搜索新闻请求
      await handleSearchAndSummarize(inputQuery);
      return;
    }

    // 常规大模型请求处理
    const newMessage: Message = { role: 'user', content: inputQuery };
    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);
    setIsStreaming(true);

    try {
      // 验证环境变量
      const deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

      if (!deepseekApiKey) {
        throw new Error('缺少 Deepseek API 密钥配置');
      }

      // 添加初始的空助手消息用于流式更新
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      // 使用流式API
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { 
              role: 'system', 
              content: '你是一个知识问答助手。请尽可能回答用户的问题。如果不确定，请诚实地说不知道。' 
            },
            ...messages.filter(msg => msg.role !== 'system').concat(newMessage)
          ],
          temperature: 0.7,
          max_tokens: 1000,
          stream: true, // 启用流式响应
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '未知错误' }));
        throw new Error(errorData.error || `HTTP 错误! 状态码: ${response.status}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder('utf-8');
      let assistantResponse = '';
      let reasoningContent = '';
      
      // 判断是否是支持思考的模型
      const useReasonerModel = isReasonerModel(selectedModel);
      console.log(`使用模型: ${selectedModel}, 是否支持思考: ${useReasonerModel}`);

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // 解析响应块
        const chunk = decoder.decode(value);
        const lines = chunk
          .split('\n')
          .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              // 处理常规内容
              if (data.choices && data.choices[0]?.delta?.content !== undefined) {
                const contentDelta = data.choices[0].delta.content || '';
                assistantResponse += contentDelta;
              }
              
              if (useReasonerModel) {
                // 处理思考内容 (reasoner模型)
                if (data.choices && data.choices[0]?.delta?.reasoning_content !== undefined) {
                  const reasoningDelta = data.choices[0].delta.reasoning_content || '';
                  reasoningContent += reasoningDelta;
                }
                
                // 更新最后一条消息的内容
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: assistantResponse,
                    thinking: reasoningContent.trim() || undefined
                  };
                  return newMessages;
                });
              } else {
                // 非reasoner模型，尝试解析thinking标签
                setMessages(prev => {
                  const newMessages = [...prev];
                  
                  // 尝试解析思考标签
                  const thinkingMatch = assistantResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
                  if (thinkingMatch) {
                    const thinking = thinkingMatch[1].trim();
                    const content = assistantResponse.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '').trim();
                    
                    newMessages[newMessages.length - 1] = {
                      role: 'assistant',
                      content: content || assistantResponse,
                      thinking: thinking
                    };
                  } else {
                    // 未找到标签，直接更新内容
                    newMessages[newMessages.length - 1] = {
                      role: 'assistant',
                      content: assistantResponse
                    };
                  }
                  
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('解析流数据时出错:', e);
              console.error('问题数据:', line);
            }
          }
        }
      }

    } catch (error: unknown) {
      console.error('Error:', error);
      let errorMessage = '未知错误';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setMessages(prev => {
        // 如果已经添加了空的助手消息，则更新它
        if (prev[prev.length - 1].role === 'assistant' && prev[prev.length - 1].content === '') {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = `抱歉，处理您的请求时出现错误：${errorMessage}`;
          return newMessages;
        }
        // 否则添加一个新的错误消息
        return [...prev, { 
          role: 'assistant', 
          content: `抱歉，处理您的请求时出现错误：${errorMessage}` 
        }];
      });
    }

    setIsLoading(false);
    setIsStreaming(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* 移动设备上的覆盖层 */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* 新增侧边栏 */}
      <div className={`fixed inset-y-0 left-0 z-30 w-72 bg-white shadow-lg transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:min-h-screen`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <span>聊天记录</span>
            </h2>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 text-gray-500 hover:text-gray-700 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-2">
            <button
              onClick={createNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>新建对话</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {chatSessions.length === 0 ? (
              <div className="text-center text-gray-500 p-4">
                <p>没有对话记录</p>
                <p className="text-sm mt-1">点击"新建对话"开始聊天</p>
              </div>
            ) : (
              <div className="space-y-1">
                {chatSessions
                  .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                  .map(session => (
                    <div
                      key={session.id}
                      onClick={() => switchToChat(session.id)}
                      className={`p-3 rounded-lg cursor-pointer flex items-center group ${
                        session.id === currentSessionId
                          ? 'bg-blue-100 text-blue-800'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">{session.title}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {new Date(session.updatedAt).toLocaleString('zh-CN', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteChat(session.id, e)}
                        className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="删除对话"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 主要内容区域 */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-0">
        <header className="bg-white shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-1 rounded-md hover:bg-gray-100"
            >
              {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            
            <Bot className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">Deepseek 聊天助手</h1>
            
            <div className="relative ml-auto flex items-center gap-2">
              <button
                onClick={createNewChat}
                className="flex items-center gap-1 text-sm text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 focus:outline-none"
                title="新建对话"
              >
                <Plus className="w-4 h-4" />
                <span>新对话</span>
              </button>
              
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-1 text-sm text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 focus:outline-none"
                disabled={isLoadingModels}
              >
                <span>{selectedModel}</span>
                {isModelDropdownOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              
              {isModelDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg z-10 py-1 text-sm">
                  <div className="p-2 border-b flex justify-between items-center">
                    <span className="font-medium text-gray-700">选择模型</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchAvailableModels();
                      }}
                      className="text-blue-600 hover:text-blue-800"
                      disabled={isLoadingModels}
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingModels ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {availableModels.length > 0 ? (
                      availableModels.map((model) => (
                        <button
                          key={model.id}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                            selectedModel === model.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                          }`}
                          onClick={() => {
                            setSelectedModel(model.id);
                            setIsModelDropdownOpen(false);
                          }}
                        >
                          {model.id}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-gray-500">
                        {isLoadingModels ? '加载中...' : '没有可用的模型'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col gap-4">
          <div 
            ref={messageContainerRef}
            className="bg-white rounded-lg shadow-sm p-4 flex-1 overflow-y-auto max-h-[calc(100vh-16rem)]"
          >
            {messages.length <= 1 ? (
              <div className="text-center text-gray-500 mt-8">
                <Bot className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>开始与Deepseek聊天助手对话！</p>
                <p className="mt-2 text-xs">当前使用模型: {selectedModel}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.filter(m => m.role !== 'system').map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {/* 添加思考内容部分 */}
                      {message.thinking && (
                        <div className="mb-3">
                          <button
                            onClick={() => toggleThinking(index)}
                            className="flex items-center text-xs text-gray-500 hover:text-gray-700 mb-1 focus:outline-none"
                          >
                            {collapsedThinking[index] ? (
                              <ChevronDown className="w-3 h-3 mr-1" />
                            ) : (
                              <ChevronUp className="w-3 h-3 mr-1" />
                            )}
                            <span>思考过程 {collapsedThinking[index] ? '(展开)' : '(收起)'}</span>
                          </button>
                          
                          {!collapsedThinking[index] && (
                            <div className="p-2 bg-gray-200 rounded text-sm text-gray-700 whitespace-pre-wrap font-mono">
                              {message.thinking}
                            </div>
                          )}
                          
                          <div className="border-t border-gray-300 my-2"></div>
                        </div>
                      )}
                      
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                      {message.role === 'assistant' && index === messages.length - 1 && isStreaming && (
                        <span className="inline-block w-2 h-4 ml-1 bg-gray-600 animate-pulse"></span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* 添加回到底部的按钮 */}
          {userHasScrolled && isStreaming && (
            <button
              onClick={() => {
                setAutoScrollEnabled(true);
                setUserHasScrolled(false);
                scrollToBottom();
              }}
              className="fixed bottom-24 right-8 bg-blue-600 text-white rounded-full p-2 shadow-lg hover:bg-blue-700"
              title="回到最新消息"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}

          <div className="bg-white rounded-lg shadow-sm p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsSearchMode(!isSearchMode)}
                className={`flex items-center justify-center px-3 h-10 rounded-lg ${
                  isSearchMode 
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } transition-colors whitespace-nowrap`}
                title={isSearchMode ? '当前为网络搜索模式' : '切换到网络搜索模式'}
              >
                网络搜索
              </button>
              
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isSearchMode ? "输入搜索内容..." : "输入您的问题..."}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Send className="w-5 h-5 text-white" />
                )}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;