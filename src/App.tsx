import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: '你是一个知识问答助手。请尽可能回答用户的问题。如果你不确定答案，请诚实地说你不知道。'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const newMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, newMessage]);
    setInput('');
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
          model: 'deepseek-chat',
          messages: messages.filter(msg => msg.role !== 'system').concat(newMessage),
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
              if (data.choices && data.choices[0]?.delta?.content) {
                const contentDelta = data.choices[0].delta.content;
                assistantResponse += contentDelta;
                
                // 更新最后一条消息的内容
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content = assistantResponse;
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('解析流数据时出错:', e);
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
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Deepseek 聊天助手</h1>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 flex-1 overflow-y-auto max-h-[calc(100vh-16rem)]">
          {messages.length <= 1 ? (
            <div className="text-center text-gray-500 mt-8">
              <Bot className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>开始与Deepseek聊天助手对话！</p>
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
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                    {message.role === 'assistant' && index === messages.length - 2 && isStreaming && (
                      <span className="inline-block w-2 h-4 ml-1 bg-gray-600 animate-pulse"></span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入您的问题..."
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
  );
}

export default App;