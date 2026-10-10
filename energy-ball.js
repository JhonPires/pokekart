(function(root){
  'use strict';
  const speed=64, lifetime=3, radius=2.6;
  function intersection(a,b,p,r=radius){
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
    const x=a.x-p.x,y=a.y-p.y,z=a.z-p.z;
    const c=x*x+y*y+z*z-r*r;
    if(c<=0)return 0;
    const length=dx*dx+dy*dy+dz*dz;
    if(!length)return null;
    const dot=x*dx+y*dy+z*dz,disc=dot*dot-length*c;
    if(disc<0)return null;
    const t=(-dot-Math.sqrt(disc))/length;
    return t>=0&&t<=1?t:null;
  }
  function createSimulation({heightAt=()=>0,getTargets=()=>[],onStep=()=>{},onHit=()=>{},onRemove=()=>{}}={}){
    const shots=new Map(),seen=new Map();let clock=0;
    function remove(id){if(shots.delete(id))onRemove(id);}
    return {shots,remove,
      add(data){
        if(!data||typeof data.id!=='string'||typeof data.owner!=='string'||seen.has(data.id)||shots.size>=32)return false;
        if(!['x','z','dx','dz'].every(k=>Number.isFinite(data[k])))return false;
        const length=Math.hypot(data.dx,data.dz);if(length<.001)return false;
        const shot={id:data.id,owner:data.owner,x:data.x,z:data.z,y:heightAt(data.x,data.z)+1,dx:data.dx/length,dz:data.dz/length,age:0};
        shots.set(shot.id,shot);seen.set(shot.id,clock+10);return true;
      },
      update(dt,paused=false,authoritative=true){
        if(paused||!Number.isFinite(dt)||dt<=0)return;
        clock+=dt;for(const [id,expiry]of seen)if(expiry<clock)seen.delete(id);
        for(const shot of shots.values()){
          const step=Math.min(dt,lifetime-shot.age),a={x:shot.x,y:shot.y,z:shot.z};
          const b={x:a.x+shot.dx*speed*step,z:a.z+shot.dz*speed*step};b.y=heightAt(b.x,b.z)+1;
          let hit=null,first=Infinity;
          if(authoritative)for(const target of getTargets()){
            if(target.id===shot.owner||target.finished)continue;
            const t=intersection(a,b,target);if(t!==null&&t<first){first=t;hit=target;}
          }
          Object.assign(shot,b);shot.age+=step;onStep(shot);
          if(hit){onHit(shot,hit);remove(shot.id);}else if(shot.age>=lifetime)remove(shot.id);
        }
      },
      clear(){for(const id of shots.keys())remove(id);seen.clear();}
    };
  }
  root.PokeEnergyBall={speed,lifetime,radius,intersection,createSimulation};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.PokeEnergyBall;
})(typeof window!=='undefined'?window:globalThis);
