const fs = require("fs");
const THREE = require("three"), Babel = require("@babel/standalone");
global.window = global;
global.React = { useEffect: () => {}, useRef: () => ({ current: null }), useState: (v) => [v, () => {}], createElement: () => null };
global.window.SBP3D_THEME = "plain";
const js = (f) => { const src = fs.readFileSync("backend/static/js/" + f, "utf8");
  eval.call(global, f === "deck3d.js" ? Babel.transform(src, { presets: [["react", { runtime: "classic" }]] }).code : src); };
js("zoneUtils.js"); js("stairGeometry.js"); js("engine.js"); js("deck3d.js");
const P = {width:22,depth:12,height:4,houseWidth:45.5,houseDepth:30,attachment:"ledger",joistSpacing:16,deckingType:"composite",railType:"steel",framingType:"wood",beamType:"dropped",snowLoad:"moderate",frostZone:"cold",lotWidth:80,lotDepth:120,setbackFront:25,setbackSide:5,setbackRear:20,houseOffsetSide:20,nextZoneId:4,zones:[{id:1,type:"add",attachEdge:"left",attachOffset:0,w:8,d:11.5,h:4,attachTo:0,label:"Zone 1",joistDir:"perpendicular",beamType:"flush",stairs:null},{id:2,type:"add",attachEdge:"right",attachOffset:0,w:8,d:12,h:4,attachTo:0,label:"Zone 2",joistDir:"perpendicular",beamType:"flush",stairs:null},{id:3,type:"add",attachEdge:"front",attachOffset:6,w:10,d:6,h:4,attachTo:0,label:"Zone 3",joistDir:"perpendicular",beamType:"dropped",stairs:null}]};
const c = window.calcStructure(P);
const scene = new THREE.Scene();
window.buildDeckScene(scene, P, c, THREE);
scene.updateMatrixWorld(true);
const side = 5.5/12;
const posts = [], beams = [];
scene.traverse((o) => { if (!o.isMesh || o.geometry.type !== "BoxGeometry") return;
  const g = o.geometry.parameters;
  if (Math.abs(g.width - side) < 0.02 && Math.abs(g.depth - side) < 0.02 && g.height >= 1.0)
    posts.push([+o.position.x.toFixed(2), +o.position.z.toFixed(2)]);
  if (Math.abs(g.height - 11.875/12) < 0.02 && Math.min(g.width,g.depth) < 0.6 && Math.max(g.width,g.depth) > 2)
    beams.push({x:+o.position.x.toFixed(2), z:+o.position.z.toFixed(2), lx:+g.width.toFixed(2), lz:+g.depth.toFixed(2)});
});
console.log("calc W D:", c.W, c.D, "postSize:", c.postSize);
console.log("rects:", JSON.stringify(window.getAdditiveRects(P).map(r=>({id:r.zone&&r.zone.id, rect:r.rect}))));
console.log("posts:", JSON.stringify(posts));
console.log("beams:", JSON.stringify(beams));
