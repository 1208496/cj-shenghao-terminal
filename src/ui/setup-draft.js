// UI-only drafts use the same per-chat preferences as the terminal. No MVU writes.
export function setupDraftStore(host){
  function chatKey(){try{const c=host.SillyTavern.getContext();const chat=c.chatId||c.getCurrentChatId();return c.characterId!==undefined&&chat?String(c.characterId)+':'+String(chat):'';}catch{return '';}}
  function read(key=chatKey()){try{return key?JSON.parse(host.localStorage.getItem('cj-shenghao:ui:v3:'+key)||'{}'):{};}catch{return {};}}
  function write(key,patch){if(!key||key!==chatKey())return false;try{host.localStorage.setItem('cj-shenghao:ui:v3:'+key,JSON.stringify({...read(key),...patch}));return true;}catch{return false;}}
  return {chatKey,read,write};
}
