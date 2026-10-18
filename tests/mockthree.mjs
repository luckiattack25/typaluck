export const DoubleSide=2, SRGBColorSpace='srgb',ACESFilmicToneMapping=4;
export class Vector3 {constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}set(x,y,z){this.x=x;this.y=y;this.z=z;return this}clone(){return new Vector3(this.x,this.y,this.z)}project(){this.x=Math.min(.94,Math.max(-.94,this.x/15-.1));this.y=Math.min(.94,Math.max(-.94,this.y/12-.2));this.z=0;return this}}
export class Vector2 {constructor(x=0,y=0){this.x=x;this.y=y}set(x,y){this.x=x;this.y=y;return this}}
export class Color{constructor(x){this.value=x||'#fff'}clone(){return new Color(this.value)}lerp(){return this}multiplyScalar(){return this}getStyle(){return typeof this.value==='string'?this.value:'#ccc'}set(x){this.value=x;return this}}
class Transform extends Vector3 {setScalar(s){this.x=this.y=this.z=s;return this}}
class Base {constructor(){this.children=[];this.position=new Vector3();this.rotation=new Transform();this.scale=new Transform(1,1,1);this.userData={};this.visible=true;this.material=null;this.geometry=null;}add(...o){this.children.push(...o);return this}remove(o){this.children=this.children.filter(x=>x!==o)}clear(){this.children=[]}traverse(f){f(this);for(let a of this.children)a.traverse?.(f)}updateWorldMatrix(){}localToWorld(v){return v.clone().set(v.x+this.position.x,v.y+this.position.y,v.z+this.position.z)}lookAt(){}}
export class Group extends Base{} export class Scene extends Base{} export class Mesh extends Base{constructor(geometry,material){super();this.geometry=geometry;this.material=material}}export class Points extends Mesh{}export class Line extends Mesh{}export class LineSegments extends Mesh{}export class GridHelper extends Base{constructor(){super();this.material=new LineBasicMaterial({})}}
export class WebGLRenderer {constructor(){this.domElement=document.createElement('canvas');this.capabilities={getMaxAnisotropy:()=>8}}setPixelRatio(){}setSize(w,h){this.domElement.width=w;this.domElement.height=h}render(){}dispose(){}}
export class PerspectiveCamera extends Base{constructor(){super();this.aspect=1}updateProjectionMatrix(){}}
export class Clock {getDelta(){return .016}}
export class FogExp2 {constructor(){}}
export class AmbientLight extends Base{}export class DirectionalLight extends Base{}export class PointLight extends Base{}
export class BufferGeometry {setFromPoints(){return this}setAttribute(){return this}dispose(){}}export class BufferAttribute {constructor(){}}
class Geo extends BufferGeometry {constructor(){super()}}
export class BoxGeometry extends Geo{}export class PlaneGeometry extends Geo{}export class CircleGeometry extends Geo{}export class CylinderGeometry extends Geo{}export class SphereGeometry extends Geo{}export class IcosahedronGeometry extends Geo{}export class OctahedronGeometry extends Geo{}export class TetrahedronGeometry extends Geo{}export class TorusGeometry extends Geo{}export class TorusKnotGeometry extends Geo{}export class TubeGeometry extends Geo{}export class EdgesGeometry extends Geo{}
class Mat {constructor(opts={}){this.color=new Color(opts.color);this.emissive=new Color(opts.emissive);this.emissiveIntensity=opts.emissiveIntensity||0;this.opacity=opts.opacity??1;this.map=opts.map;this.transparent=opts.transparent||false}dispose(){}}
export class MeshBasicMaterial extends Mat{}export class MeshStandardMaterial extends Mat{}export class LineBasicMaterial extends Mat{}export class PointsMaterial extends Mat{}
export class CanvasTexture{constructor(img){this.image=img;this.needsUpdate=false}clone(){return new CanvasTexture(this.image)}dispose(){}}
export class TextureLoader {setCrossOrigin(){}load(url,success,error,onerror){const tex=new CanvasTexture(document.createElement('canvas'));setTimeout(()=>success?.(tex),10);return tex}}
export class CatmullRomCurve3{constructor(points){this.points=points}}
export class QuadraticBezierCurve3{constructor(a,b,c){this.a=a;this.b=b;this.c=c}getPoints(n){return Array.from({length:n+1},(_,i)=>new Vector3())}}
export class Raycaster {setFromCamera(){}intersectObjects(list){const idx=window.__fakeSongTargetIndex;const candidates=list.filter(x=>x.userData?.trackSong);return idx>=0&&idx<candidates.length?[{object:candidates[idx]}]:[]}}
