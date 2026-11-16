import fs from 'node:fs/promises';
import vm from 'node:vm';
import {z} from 'zod';
import {clone,requireRule} from '../src/core/engine.js';
import {createSchema} from '../src/runtime/schema.js';
import {settleNative,allowModelCommand,prepareModelCommand,refreshContext,withoutUpdates,replayPlayerCommand} from '../src/runtime/settlement.js';

export function eventBus({brokenStop=false}={}){
 const listeners=new Map();
 return {
  eventOn(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return {stop:()=>{if(!brokenStop)listeners.get(name)?.delete(fn);}};},
  eventRemoveListener(name,fn){listeners.get(name)?.delete(fn);},
  async emit(name,...args){for(const fn of [...(listeners.get(name)||[])])await fn(...args);},
  count(name){return listeners.get(name)?.size||0;}
 };
}
export const events={VARIABLE_UPDATE_STARTED:'start',COMMAND_PARSED:'parsed',VARIABLE_UPDATE_ENDED:'ended',BEFORE_MESSAGE_UPDATE:'saving',VARIABLE_INITIALIZED:'initialized'};
// Execute the maintained host's real registration/settlement callbacks. Only the
// external event bus, message reader and UI refresh are substituted (no browser).
export async function hostBinding({source,sourceAnchor,body,bus=eventBus()}={}){
 source??=await fs.readFile(new URL('../src/runtime/host.js',import.meta.url),'utf8');
 const declaration=source.match(/^const listeners=.*$/m)[0];
 const functions=source.slice(source.indexOf('function on('),source.indexOf('async function generateProfile('));
 const schemas=createSchema(z),message={message_id:sourceAnchor.messageId,swipe_id:sourceAnchor.swipeId,role:'assistant',message:body,swipes_data:[]};
 let nativeObject={events};
 const context=vm.createContext({clone,requireRule,settleNative,allowModelCommand,prepareModelCommand,refreshContext,withoutUpdates,replayPlayerCommand,
  eventOn:bus.eventOn,eventRemoveListener:bus.eventRemoveListener,schemas:()=>schemas,native:()=>nativeObject,
  branch:()=>sourceAnchor.branchKey,messageList:()=>[message],textOf:m=>m.message,clean:s=>String(s).trim(),
  anchorOf:async()=>clone(sourceAnchor),digest:async s=>s,publish:()=>{},schedule:()=>{},console:{log:()=>{}}});
 vm.runInContext(`let disposed=false,mvuBusy=false,diagnostics=[];${declaration}\n${functions}\n globalThis.binding={bind:bindMvu,dispose(){disposed=true;stops.forEach(stop=>stop());},inspect(){return diagnostics;}};`,context);
 return {bus,bind:()=>context.binding.bind(),replaceNative(){nativeObject={events:{...events}};},dispose:()=>context.binding.dispose(),diagnostics:()=>clone(context.binding.inspect()),
  async run(before,patch){const vars={stat_data:{shenghao:clone(before)}},oldVars=clone(vars);
   const commands=Object.entries(patch).map(([path,value])=>({type:'set',args:['shenghao.'+path,JSON.stringify(value)]}));
   await bus.emit(events.VARIABLE_UPDATE_STARTED,vars);await bus.emit(events.COMMAND_PARSED,vars,commands,body);
   for(const cmd of commands){const keys=cmd.args[0].split('.');let target=vars.stat_data;for(const k of keys.slice(0,-1))target=target[k];target[keys.at(-1)]=JSON.parse(cmd.args[1]);}
   await bus.emit(events.VARIABLE_UPDATE_ENDED,vars,oldVars);return {vars,oldVars};
  }
 };
}
