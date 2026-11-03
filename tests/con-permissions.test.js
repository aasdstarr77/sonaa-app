const test=require('node:test');const assert=require('node:assert/strict');
const {getPermissions,canRead,canWrite,isRoot}=require('../src/con/permissions');
test('root admin receives every permission',()=>{const p=getPermissions({role:'admin',adminRoleLabel:'أدمن رئيسي'});assert.equal(isRoot({adminRoleLabel:'أدمن رئيسي'}),true);assert.equal(canWrite(p,'settings'),true);assert.equal(canWrite(p,'adminUsers'),false);});
test('read-only role can read but cannot write',()=>{const p=getPermissions({role:'admin',adminRole:'قراءة فقط'});assert.equal(canRead(p,'orders'),true);assert.equal(canWrite(p,'orders'),false);});
test('supervisor write permissions stay scoped',()=>{const p=getPermissions({role:'admin',adminRole:'مشرف'});assert.equal(canWrite(p,'orders'),true);assert.equal(canWrite(p,'settings'),false);});
test('sparse custom overrides replace only explicit permission fields',()=>{const p=getPermissions({role:'admin',adminRole:'مشرف',adminPermissions:{__customOverrides:true,settings:{read:true,write:false}}});assert.equal(canRead(p,'settings'),true);assert.equal(canWrite(p,'settings'),false);assert.equal(canWrite(p,'orders'),true);});
