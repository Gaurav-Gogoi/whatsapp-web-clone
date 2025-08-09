import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, MoreVertical, Search, Send, Smile, Paperclip, Check, CheckCheck } from 'lucide-react';

// A helper function to format timestamps nicely
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Main App component
function App() {
  const [conversations, setConversations] = useState([]);
  const [selectedWaId, setSelectedWaId] = useState(null);
  const [newMessageText, setNewMessageText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Define the API URL as a hardcoded string to avoid the 'import.meta' warning.
  const apiUrl = 'https://whatsapp-web-clone-dl5j.onrender.com';

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        // Use the apiUrl variable for the API call
        const response = await fetch(`${apiUrl}/api/messages/conversations`);
        if (!response.ok) {
          throw new Error('Failed to fetch conversations');
        }
        const data = await response.json();
        setConversations(data);
        
        if (!selectedWaId && data.length > 0) {
          setSelectedWaId(data[0].wa_id);
        }
      } catch (error) {
        console.error("Polling failed:", error);
      }
    };

    fetchConversations();
    
    const intervalId = setInterval(fetchConversations, 2000);
    
    return () => clearInterval(intervalId);
  }, [selectedWaId, apiUrl]);

  useEffect(() => {
    scrollToBottom();
  }, [conversations, selectedWaId]);

  const selectedConversation = conversations.find(conv => conv.wa_id === selectedWaId);
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessageText.trim() || !selectedWaId) return;

    const tempId = `temp-${Date.now()}`;
    const newMsg = {
      id: tempId,
      text: newMessageText,
      timestamp: Date.now(),
      status: 'sent',
      fromMe: true,
    };

    setConversations(prevConversations => prevConversations.map(conv => {
      if (conv.wa_id === selectedWaId) {
        return {
          ...conv,
          messages: [...conv.messages, newMsg],
          lastMessage: newMsg.text,
        };
      }
      return conv;
    }));
    setNewMessageText('');

    try {
      // Use the apiUrl variable for the API call
      await fetch(`${apiUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wa_id: selectedWaId, text: newMsg.text }),
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const renderStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <Check size={16} className="text-gray-400" />;
      case 'delivered':
        return <CheckCheck size={16} className="text-gray-400" />;
      case 'read':
        return <CheckCheck size={16} className="text-blue-500" />;
      default:
        return null;
    }
  };

  const MessageBubble = ({ message }) => {
    const isFromMe = message.fromMe;
    return (
      <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`relative max-w-[70%] px-3 py-2 rounded-lg shadow-sm mb-2 ${
            isFromMe ? 'bg-[#D9FDD3] rounded-br-none' : 'bg-white rounded-bl-none'
          }`}
        >
          <p className="text-sm">{message.text || 'Attachment'}</p>
          <div className="flex items-center justify-end text-xs text-gray-500 mt-1">
            <span className="mr-1">{formatTime(message.timestamp)}</span>
            {isFromMe && renderStatusIcon(message.status)}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="flex h-screen w-full bg-[#EFEAE2] font-sans">
      <aside
        className={`w-full md:w-1/3 lg:w-1/4 bg-[#EFEAE2] border-r border-gray-300 transition-all duration-300 ease-in-out transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } absolute md:relative z-10 h-full flex flex-col`}
      >
        <div className="flex items-center p-4 bg-[#00A884] text-white h-16">
          <h2 className="text-xl font-semibold">WhatsApp</h2>
          <MoreVertical size={24} />
        </div>

        <div className="p-2 border-b border-gray-300">
          <div className="relative">
            <input
              type="text"
              placeholder="Search or start new chat"
              className="w-full bg-white p-2 pl-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A884]"
            />
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {conversations.map(conv => (
            <div
              key={conv.wa_id}
              className={`flex items-center p-4 cursor-pointer border-b border-gray-200 transition-colors duration-200 ${
                selectedWaId === conv.wa_id ? 'bg-[#F0F2F5]' : 'hover:bg-[#F0F2F5]'
              }`}
              onClick={() => {
                setSelectedWaId(conv.wa_id);
                setIsSidebarOpen(false);
              }}
            >
              <div className="flex-shrink-0 h-12 w-12 bg-gray-400 rounded-full flex items-center justify-center text-white text-lg font-bold">
                {conv.name ? conv.name.charAt(0) : '?'}
              </div>
              <div className="ml-4 flex-1 overflow-hidden">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-base truncate">{conv.name || 'Unknown User'}</h3>
                  <span className="text-xs text-gray-500">
                    {/* Get the timestamp from the last message */}
                    {conv.messages && conv.messages.length > 0 ? formatTime(conv.messages[conv.messages.length - 1].timestamp) : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-600 truncate mt-1">
                  {/* Use the lastMessage field from the conversation object */}
                  {conv.lastMessage || 'Start a new conversation'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedConversation && (
          <>
            <div className="flex items-center p-4 bg-[#00A884] text-white h-16">
              <button
                className="md:hidden mr-4"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Back to conversations"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="flex-shrink-0 h-10 w-10 bg-gray-400 rounded-full flex items-center justify-center text-white text-lg font-bold">
                {selectedConversation.name ? selectedConversation.name.charAt(0) : '?'}
              </div>
              <div className="ml-4 flex-1">
                <h3 className="font-semibold text-base">{selectedConversation.name || 'Unknown User'}</h3>
                <p className="text-xs text-gray-200">{selectedConversation.wa_id}</p>
              </div>
              <div className="flex space-x-4">
                <Search size={24} className="cursor-pointer" />
                <MoreVertical size={24} className="cursor-pointer" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://placehold.co/800x600/F0E5D3/F0E5D3?text=')] bg-repeat">
              {selectedConversation.messages && selectedConversation.messages.length > 0 ? (
                selectedConversation.messages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No messages yet.
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="flex items-center p-4 bg-[#F0F2F5] shadow-md">
              <div className="flex items-center space-x-4">
                <Smile size={24} className="text-gray-500 cursor-pointer" />
                <Paperclip size={24} className="text-gray-500 cursor-pointer" />
              </div>
              <input
                type="text"
                placeholder="Type a message"
                className="flex-1 mx-4 p-2 pl-4 rounded-full bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00A884]"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
              />
              <button type="submit" className="bg-[#00A884] p-3 rounded-full text-white hover:bg-[#008A7C] transition-colors duration-200">
                <Send size={24} />
              </button>
            </form>
          </>
        )}

        {!selectedConversation && (
          <div className="flex items-center justify-center flex-1 text-gray-500 text-lg md:text-xl p-4 text-center bg-[#EFEAE2]">
            Select a chat to start a conversation.
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
