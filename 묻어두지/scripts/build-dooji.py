"""Build Dooji's original local-only animation prototype with Blender 5.2.

Run: Blender --background --factory-startup --python scripts/build-dooji.py
No network, downloaded assets, or AI inference. Geometry is authored here.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/characters/3d'
PREVIEW = OUT / 'preview'
OUT.mkdir(parents=True, exist_ok=True)
PREVIEW.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--render', choices=['hero', 'movies', 'none'], default='hero')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.actions):
    bpy.data.actions.remove(block)
scene = bpy.context.scene
scene.render.fps = 24
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.image_settings.file_format = 'PNG'
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.world.color = (.4, .4, .4)
scene.view_settings.view_transform = 'AgX'

def srgb(v):
    return v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4

def mat(name, color, rough=.55, metal=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    c = tuple(srgb(int(color[i:i+2], 16) / 255) for i in (0, 2, 4)) + (1,)
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = c
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    m.diffuse_color = c
    return m

M = {
    'fur': mat('Walnut / soft clay', '875B40', .68),
    'furLight': mat('Cocoa tips', 'A77852', .67),
    'muzzle': mat('Honey cream', 'E8C89F', .65),
    'belly': mat('Warm belly', 'BD8B5D', .68),
    'nose': mat('Terracotta nose', 'BD7665', .46),
    'innerEar': mat('Ear blush', 'C89278', .62),
    'white': mat('Warm eye white', 'FFFAEA', .26),
    'iris': mat('Hazel iris', '905A28', .25),
    'pupil': mat('Espresso eyes', '241B19', .18),
    'smile': mat('Smile / brows', '533C2D', .68),
    'scarf': mat('Sky blue cotton', '92C4D9', .72),
    'scarfLight': mat('Scarf seam', 'B5D7E3', .65),
    'claw': mat('Sand claws', 'D5B391', .57),
    'wood': mat('Honey ash handle', 'CEA879', .55),
    'blade': mat('Blue steel', '83A0A6', .36, .35),
    'edge': mat('Spade edge', 'C7D8D7', .3, .4),
    'capsule': mat('Cloud blue enamel', 'B0D8E5', .32),
    'band': mat('Deep blue band', '5088A0', .4),
    'seal': mat('Butter seal', 'F2D997', .46),
    'dirt': mat('Toffee soil', 'B19270', .88),
    'dirtLight': mat('Soil highlights', 'C7AF8B', .86),
    'hole': mat('Hole interior', '4E3B30', 1),
    'lock': mat('Butter yellow lock', 'F3D892', .4),
    'lockDark': mat('Lock shackle', 'C89858', .36, .25),
    'grass': mat('Sage shoots', '8DAF94', .85),
    'floor': mat('Studio ivory', 'F6F1E7', .85),
}

parts = []
def finish(obj, name, material, bone=None):
    obj.name = name
    obj.data.materials.append(M[material])
    for p in obj.data.polygons:
        p.use_smooth = True
    if bone:
        parts.append((obj, bone))
    return obj

def uv(name, loc, scale, material, bone=None, seg=20, rings=12, rot=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    if rot:
        obj.rotation_euler = tuple(math.radians(x) for x in rot)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, material, bone)

def mesh(name, verts, faces, material, bone=None, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    finish(obj, name, material, bone)
    if bevel:
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new('Soft handmade edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def curve(name, coords, radius, material, bone=None, cyclic=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 8
    data.bevel_depth = radius
    data.bevel_resolution = 2
    sp = data.splines.new('BEZIER')
    sp.bezier_points.add(len(coords)-1)
    for pt, co in zip(sp.bezier_points, coords):
        pt.co = co
        pt.handle_left_type = 'AUTO'
        pt.handle_right_type = 'AUTO'
    sp.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    return finish(bpy.context.object, name, material, bone)

def bar(name, a, b, radius, material, bone=None):
    d = Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=d.length,
                                      location=(Vector(a)+Vector(b))/2)
    obj = bpy.context.object
    obj.rotation_euler = d.to_track_quat('Z','Y').to_euler()
    return finish(obj, name, material, bone)

# A single named armature controls the whole vignette, including props. Each
# mesh is rigid-weighted: an intentional toy-like prototype, not a fur sim.
armdata = bpy.data.armatures.new('Dooji skeleton')
rig = bpy.data.objects.new('Dooji_Rig', armdata)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bone_defs = {
    'Root': ((0,0,0), None),
    'Body': ((0,0,.43), 'Root'),
    'Head': ((0,0,1.1), 'Body'),
    'Arm.L': ((-.38,0,.98), 'Body'),
    'Arm.R': ((.38,0,.98), 'Body'),
    'Foot.L': ((-.23,0,.13), 'Root'),
    'Foot.R': ((.23,0,.13), 'Root'),
    'Eye.L': ((-.213,-.338,1.395), 'Head'),
    'Eye.R': ((.213,-.338,1.395), 'Head'),
    'Brow.L': ((-.22,-.35,1.56), 'Head'),
    'Brow.R': ((.22,-.35,1.56), 'Head'),
    'Mouth': ((0,-.46,1.12), 'Head'),
    'Shovel': ((.51,-.15,.64), 'Arm.R'),
    'Capsule': ((0,0,0), None),
    'Cover': ((0,-.68,-.012), None),
    'Lock': ((0,-.68,.32), None),
}
for i in range(7):
    bone_defs['Dirt.%02d'%i] = ((0,-.68,.02), None)
for name, (p, parent) in bone_defs.items():
    b = armdata.edit_bones.new(name)
    b.head = p
    b.tail = Vector(p)+Vector((0,.13,0))  # identity rest axes
    if parent:
        b.parent = armdata.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')

# Soft, pear-shaped body. Vertex shaping avoids a stack of perfect spheres.
body = uv('Pear body', (0,0,.66), (.43,.32,.52), 'fur', 'Body', 32, 20)
for v in body.data.vertices:
    t = v.co.z/.52
    v.co.x *= 1-.13*t
    v.co.y *= 1-.08*t
uv('Velvet tummy', (0,-.29,.64), (.29,.073,.34), 'belly', 'Body')
uv('Broad expressive head', (0,-.015,1.29), (.505,.365,.425), 'fur', 'Head', 32, 20)
for side, label in [(-1,'L'),(1,'R')]:
    uv('Round ear '+label, (side*.435,.01,1.565), (.098,.066,.109), 'fur', 'Head', 20,12)
    uv('Ear inside '+label, (side*.445,-.041,1.577), (.058,.021,.071), 'innerEar', 'Head', 16,10)
    uv('Cream cheek '+label, (side*.145,-.334,1.16), (.242,.137,.174), 'muzzle', 'Head')
    uv('Cheek blush '+label, (side*.333,-.342,1.19), (.046,.013,.027), 'innerEar', 'Head', 16,10)
    uv('Eye white '+label, (side*.213,-.334,1.395), (.131,.078,.155), 'white', 'Eye.'+label)
    uv('Hazel iris '+label, (side*.201,-.401,1.391), (.074,.022,.096), 'iris', 'Eye.'+label,20,12)
    uv('Pupil '+label, (side*.196,-.418,1.393), (.043,.012,.071), 'pupil', 'Eye.'+label,20,12)
    uv('Eye catchlight '+label, (side*.201-.023,-.43,1.429), (.020,.009,.024), 'white', 'Eye.'+label,12,8)
    uv('Eye pin light '+label, (side*.201+.018,-.432,1.36), (.008,.005,.008), 'white', 'Eye.'+label,12,8)
    curve('Brow '+label, [(side*.11,-.35,1.565),(side*.218,-.377,1.593),(side*.315,-.326,1.548)], .020,'smile','Brow.'+label)
    uv('Arm '+label, (side*.447,0,.81), (.14,.137,.257), 'fur','Arm.'+label,24,14, (0,side*-14,0))
    uv('Paw '+label, (side*.505,-.12,.64), (.15,.122,.141), 'furLight','Arm.'+label,24,14)
    for j in range(3):
        uv('Paw claw %s%d'%(label,j), (side*.505+(j-1)*.066,-.199,.604), (.028,.064,.044), 'claw','Arm.'+label,12,8, (22,0,0))
    uv('Foot '+label,(side*.23,-.063,.11),(.19,.235,.112),'fur','Foot.'+label,24,14)
    for j in range(3):
        uv('Toe claw %s%d'%(label,j),(side*.23+(j-1)*.081,-.258,.086),(.038,.066,.028),'claw','Foot.'+label,12,8)
uv('Soft pink nose',(0,-.475,1.25),(.091,.065,.065),'nose','Head',24,14)
for side in (-1,1):
    uv('Nostril '+str(side),(side*.037,-.532,1.249),(.009,.006,.010),'smile','Head',12,8)
curve('Cheeky curved smile',[(-.214,-.454,1.125),(-.12,-.463,1.081),(0,-.464,1.075),(.13,-.463,1.093),(.219,-.449,1.139)],.009,'smile','Mouth')
curve('Nose seam',[(0,-.476,1.207),(0,-.477,1.174),(0,-.468,1.15)],.006,'smile','Head')
for i, (x,z,tilt) in enumerate([(-.115,1.65,-24),(-.04,1.688,-15),(.044,1.697,18)]):
    uv('Forelock '+str(i),(x,-.07,z),(.068,.11,.108),'fur','Head',16,10,(0,tilt,-12))
# Scarf: full collar, triangular bib and two small tied tails.
curve('Scarf rolled collar',[(.31,-.07,1.065),(.23,-.28,1.05),(0,-.35,1.035),(-.27,-.22,1.05),(-.32,.07,1.07),(0,.26,1.09),(.31,.09,1.09)],.053,'scarf','Body',True)
verts=[(-.25,-.317,1.066),(.245,-.317,1.066),(.024,-.395,.832),(-.25,-.287,1.066),(.245,-.287,1.066),(.024,-.365,.832)]
mesh('Scarf bib',verts,[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],'scarf','Body',.019)
curve('Scarf hand sewn hem',[(-.213,-.337,1.032),(.023,-.408,.861),(.209,-.337,1.032)],.005,'scarfLight','Body')
uv('Scarf knot',(.327,.01,1.084),(.068,.078,.071),'scarf','Body',16,10)
uv('Scarf tail one',(.413,.07,1.13),(.14,.039,.054),'scarf','Body',16,10,(0,-26,15))
uv('Scarf tail two',(.405,.055,1.016),(.12,.038,.052),'scarf','Body',16,10,(0,29,-12))

# A miniature spade rests in the right paw. It is not fused to the body.
bar('Ash shovel shaft',(.51,-.163,.24),(.51,-.163,.83),.027,'wood','Shovel')
bar('T handle',(.424,-.163,.81),(.596,-.163,.81),.028,'wood','Shovel')
bar('Steel socket',(.51,-.163,.205),(.51,-.163,.34),.034,'blade','Shovel')
blade=[(.40,-.185,.27),(.62,-.185,.27),(.618,-.194,.115),(.565,-.195,.065),(.51,-.195,.046),(.455,-.195,.065),(.402,-.194,.115)]
vv=blade+[(x,y+.027,z) for x,y,z in blade]
ff=[tuple(range(6,-1,-1)),tuple(range(7,14))]+[(i,(i+1)%7,(i+1)%7+7,i+7) for i in range(7)]
mesh('Rounded spade blade',vv,ff,'blade','Shovel',.012)
curve('Spade lip',[(.407,-.209,.12),(.452,-.211,.069),(.51,-.211,.052),(.568,-.211,.069),(.612,-.209,.12)],.009,'edge','Shovel')

# Capsule is modelled at origin; its prop bone places it in a hand or the hole.
uv('Capsule shell',(0,0,0),(.24,.132,.125),'capsule','Capsule',32,16)
uv('Capsule band',(0,-.001,0),(.038,.138,.13),'band','Capsule',20,12)
uv('Capsule wax seal',(0,-.131,.012),(.05,.014,.048),'seal','Capsule',20,12)
curve('Seal sprout',[(0,-.148,-.005),(0,-.148,.028)],.004,'band','Capsule')
uv('Seal leaf',(.011,-.148,.019),(.014,.003,.007),'band','Capsule',12,8,(0,25,0))

# The dirt patch really has an opening in its top surface. It cannot excavate
# the real camera image: this shallow miniature stage is part of the asset.
N=64
outer=[]; inner=[]
for i in range(N):
    t=2*math.pi*i/N
    wobble=1+.015*math.sin(5*t)+.01*math.cos(7*t)
    outer.append((.98*math.cos(t)*wobble,-.29+.99*math.sin(t)*wobble,-.024))
    inner.append((.40*math.cos(t),-.68+.36*math.sin(t),-.024))
bottom=[(x,y,-.13) for x,y,z in outer]
faces=[]
for i in range(N):
    j=(i+1)%N
    faces.extend([(i,j,N+j,N+i),(i,2*N+i,2*N+j,j)])
mesh('Sculpted earth patch',outer+inner+bottom,faces,'dirt')
mesh('Hole inner wall',inner+[(x,y,-.11) for x,y,z in inner],[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)],'hole')
uv('Dark bottom',(0,-.68,-.11),(.40,.36,.019),'hole',None,32,12)
uv('Movable soil cover',(0,-.68,-.025),(.403,.363,.024),'dirt','Cover',32,12)
curve('Soft opening rim',[(.41*math.cos(2*math.pi*i/20),-.68+.37*math.sin(2*math.pi*i/20),-.011) for i in range(20)],.027,'dirtLight',None,True)
for i,(x,y,s) in enumerate([(-.62,-.65,.07),(.66,-.58,.088),(-.53,-.86,.057),(.56,-.95,.049),(.77,-.14,.056),(-.67,.14,.066),(.43,.44,.05)]):
    uv('Pebble %02d'%i,(x,y,-.006),(s,s*.76,s*.5),'dirtLight',None,12,8)
for j,(x,y) in enumerate([(-.73,.1),(.70,.22),(-.56,-.99)]):
    for k in range(2):
        curve('Shoot %s%s'%(j,k),[(x,y,0),(x+(k-.5)*.05,y,.08),(x+(k-.5)*.10,y+.02,.13-k*.03)],.013,'grass')
for i in range(7):
    uv('Flying crumb %02d'%i,(0,-.68,.02),(.037+(i%3)*.011,.032,.028),'dirtLight','Dirt.%02d'%i,12,8)

# Friendly lock sign. Rounded solid silhouette, no text or error-red color.
uv('Lock round body',(0,-.68,.29),(.135,.061,.115),'lock','Lock',24,14)
curve('Lock arch',[(-.079,-.68,.35),(-.078,-.68,.445),(0,-.68,.488),(.078,-.68,.445),(.079,-.68,.35)],.025,'lockDark','Lock')
uv('Lock keyhole',(0,-.741,.31),(.018,.005,.021),'smile','Lock',12,8)
bar('Lock key stem',(0,-.744,.308),(0,-.744,.266),.009,'smile','Lock')

# Apply object transforms and bind geometry with valid skin weights.
for obj,bone in parts:
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    group=obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    mod=obj.modifiers.new('Dooji skin','ARMATURE')
    mod.object=rig
    obj.parent=rig

def pose(name, loc=(0,0,0), rot=(0,0,0), scale=(1,1,1)):
    b=rig.pose.bones[name]
    b.rotation_mode='XYZ'
    b.location=loc
    b.rotation_euler=tuple(math.radians(x) for x in rot)
    b.scale=scale

def mix(a,b,t): return a+(b-a)*t
def ease(t):
    t=max(0,min(1,t))
    return t*t*(3-2*t)
def track(t,keys):
    if t<=keys[0][0]: return keys[0][1]
    for (ta,a),(tb,b) in zip(keys,keys[1:]):
        if t<=tb:
            k=ease((t-ta)/(tb-ta))
            if isinstance(a,tuple): return tuple(mix(x,y,k) for x,y in zip(a,b))
            return mix(a,b,k)
    return keys[-1][1]
def visible(name,amount):
    rig.pose.bones[name].scale=(max(.0001,amount),)*3

def hand_position(side='L'):
    b=rig.pose.bones['Arm.'+side]
    rest=armdata.bones['Arm.'+side].matrix_local
    p=Vector((-.505 if side=='L' else .505,-.245,.665))
    return b.matrix @ rest.inverted() @ p

def aim_hand(side, target):
    b=rig.pose.bones['Arm.'+side]
    parent_delta=b.parent.matrix @ b.parent.bone.matrix_local.inverted()
    target_rest=parent_delta.inverted() @ Vector(target)
    p=Vector((-.505 if side=='L' else .505,-.245,.665))
    rest_vector=p-b.bone.head_local
    wanted=target_rest-b.bone.head_local
    b.rotation_euler=rest_vector.rotation_difference(wanted).to_euler('XYZ')
    bpy.context.view_layer.update()

def reset():
    for b in rig.pose.bones:
        pose(b.name)
    for name in ['Capsule','Lock']+['Dirt.%02d'%i for i in range(7)]:
        visible(name,0)

def digs(t, start=.35, end=2.4):
    ramp=ease((t-start)/.2)*(1-ease((t-end)/.22))
    phase=(t-start)*2*math.pi/1.05
    swing=(.5-.5*math.cos(phase))*ramp
    pose('Body',loc=(0,0,-.075*swing),rot=(11*swing,0,0))
    pose('Arm.R',rot=(-52*swing,0,-5))
    pose('Head',rot=(-5*swing,0,-5*swing))
    for i in range(7):
        u=((t-start-.49-i*.025)%1.05)/.47
        active=start+.49+i*.025<t<end+.3 and u<1
        visible('Dirt.%02d'%i,.8 if active else 0)
        if active:
            sign=-1 if i%2 else 1
            pose('Dirt.%02d'%i,loc=(sign*(.18+.43*u),-.02-.16*u,.035+.43*math.sin(math.pi*u)),rot=(u*220,i*39,u*110),scale=(.85,)*3)

def animate(kind,t):
    reset()
    breath=math.sin(t*math.pi*1.15)
    pose('Body',scale=(1+.006*breath,1+.005*breath,1+.008*breath))
    pose('Head',rot=(-2,0,-3))
    # Blink gently; independent eye bones preserve the eyelid-free toy style.
    blink=1-.90*max(0,1-abs((t%3.4)-2.62)/.085)
    for side in ('L','R'):
        rig.pose.bones['Eye.'+side].scale.z=blink
    if kind=='Idle':
        pose('Arm.R',rot=(0,0,-4))
    elif kind=='DigLoop':
        digs(t,0,2.2)
        visible('Cover',1-ease(t/.5))
    elif kind=='Bury':
        digs(t,.25,2.17)
        pose('Arm.L',rot=(-43,0,9))
        if t>2.3:
            pose('Body',rot=(track(t,[(2.3,0),(2.9,22),(3.5,18),(4.2,5),(4.7,0)]),0,0))
            pose('Arm.R',rot=(track(t,[(2.3,0),(3.4,-18),(3.9,-27),(4.13,-6),(4.32,-24),(4.55,-4),(4.8,0)]),0,-5))
            pose('Arm.L',rot=(track(t,[(2.3,-43),(2.95,-73),(3.5,-53),(4.25,0)]),0,9))
            pose('Head',rot=(track(t,[(2.3,0),(2.9,14),(4.35,0),(4.8,10),(5.05,-7),(5.3,0)]),0,-4))
        visible('Cover',track(t,[(0,1),(.85,1),(1.6,0),(3.55,0),(4.3,1)]))
        bpy.context.view_layer.update()
        p=tuple(hand_position())
        dest=(0,-.68,.045)
        k=ease((t-2.95)/.6)
        p=tuple(mix(x,y,k) for x,y in zip(p,dest))
        if t>3.55: p=(0,-.68,track(t,[(3.55,.045),(3.85,-.12)]))
        pose('Capsule',loc=p,rot=(0,track(t,[(0,-12),(2.55,-12),(3.1,0)]),0))
        visible('Capsule',1-ease((t-3.69)/.14))
    elif kind=='Retrieve':
        digs(t,.55,2.0)
        visible('Cover',track(t,[(0,1),(.9,1),(1.6,0)]))
        if t<.5: pose('Head',rot=(8,0,track(t,[(0,-4),(.3,-19),(.5,0)])))
        # Dive into the virtual opening, then emerge with the capsule.
        dive=track(t,[(0,0),(2.0,0),(2.32,.24),(2.65,1),(3.12,1),(3.8,0)])
        forward=track(t,[(0,0),(2,0),(2.38,-.56),(3.75,-.56),(4.45,-.10)])
        pose('Root',loc=(0,forward,-1.9*dive))
        if 2.3<t<3.25: visible('Root',1-ease((dive-.72)/.23))
        visible('Shovel',1-ease((t-2.05)/.15))
        if t>2.0:
            pose('Body',rot=(track(t,[(2,0),(2.45,30),(3.2,0)]),0,0))
            pose('Arm.L',rot=(-62,0,-12))
            pose('Arm.R',rot=(-62,0,12))
            pose('Head',rot=(track(t,[(2,0),(3.25,8),(3.8,-8),(4.8,-4)]),0,3))
        bpy.context.view_layer.update()
        if t>2.0:
            root_delta=rig.pose.bones['Root'].matrix @ armdata.bones['Root'].matrix_local.inverted()
            aim_hand('L',root_delta @ Vector((-.21,-.42,.84)))
            aim_hand('R',root_delta @ Vector((.21,-.42,.84)))
        left=hand_position('L'); right=hand_position('R')
        p=(left+right)/2
        p.y-=.025
        pose('Capsule',loc=p,rot=(0,0,track(t,[(3.4,-9),(3.7,7),(4.0,-4),(4.3,0)])))
        visible('Capsule',ease((t-3.15)/.30))
    elif kind=='LockedDisappointed':
        pose('Arm.R',rot=(track(t,[(0,0),(.6,-57),(.83,-7),(.96,-32),(1.14,-17),(1.45,-8),(2.35,9),(3.6,0)]),0,-5))
        pose('Body',loc=(0,track(t,[(0,0),(.88,0),(1.01,.09),(1.3,0)]),track(t,[(0,0),(1.3,0),(2.1,-.09),(3.8,0)])),rot=(track(t,[(0,0),(1.3,0),(2.1,12),(3.8,0)]),0,0))
        pose('Head',rot=(track(t,[(0,-2),(1.05,-10),(1.55,0),(2.1,20),(3.8,-2)]),0,track(t,[(0,0),(1.4,0),(1.7,14),(2.2,4),(3.8,-3)])))
        pose('Arm.L',rot=(0,track(t,[(0,0),(2.2,12),(3.8,0)]),0))
        sadness=track(t,[(0,0),(1.5,0),(2.1,1),(3.8,0)])
        pose('Mouth',rot=(0,180*sadness,0),scale=(1-.25*sadness,1,1-.55*sadness))
        for side,sign in [('L',-1),('R',1)]:
            pose('Brow.'+side,rot=(0,sign*track(t,[(0,0),(1.5,0),(2.1,17),(3.8,0)]),0))
            rig.pose.bones['Eye.'+side].scale.z=blink*(1-.30*sadness)
        lock_scale=track(t,[(0,0),(.66,0),(.78,1.15),(.93,1),(2.9,1),(3.65,0)])
        pose('Lock',loc=(.035*math.sin((t-.84)*65)*math.exp(-max(0,t-.84)*12) if .84<t<1.2 else 0,0,.04*math.sin(t*4)),rot=(0,0,0),scale=(max(.0001,lock_scale),)*3)

CLIPS={'Idle':3.4,'DigLoop':2.6,'Bury':5.6,'Retrieve':5.7,'LockedDisappointed':4.0}
actions={}
rig.animation_data_create()
for name,duration in CLIPS.items():
    action=bpy.data.actions.new(name)
    action.use_fake_user=True
    rig.animation_data.action=action
    for frame in range(1,round(duration*24)+2):
        scene.frame_set(frame)
        animate(name,(frame-1)/24)
        for b in rig.pose.bones:
            for field in ('location','rotation_euler','scale'):
                b.keyframe_insert(field,frame=frame,group=b.name)
    actions[name]=action
rig.animation_data.action=actions['Idle']
scene.frame_start=1
scene.frame_end=83
scene.frame_set(1)

# Studio lights and backdrop are preview-only and omitted from the GLB.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.135))
finish(bpy.context.object,'Studio backdrop','floor')
backdrop=bpy.context.object
def area(name,loc,power,size,color):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.shape='DISK'
    data.size=size
    data.color=color
    o=bpy.data.objects.new(name,data)
    scene.collection.objects.link(o)
    o.location=loc
    o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
area('Large warm key',(-3,-4,6),550,4,(1,.90,.77))
area('Cool soft fill',(4,-1,3),330,3,(.79,.9,1))
area('Cream rim',(-1,3,4),650,3,(1,.93,.81))
camera_data=bpy.data.cameras.new('Preview camera')
camera=bpy.data.objects.new('Preview camera',camera_data)
scene.collection.objects.link(camera)
camera.location=(2.6,-5.4,2.8)
camera.rotation_euler=(Vector((0,-.2,.77))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'
camera_data.ortho_scale=2.9
scene.camera=camera

# One GLB with five named skeletal clips. Static stage meshes are exported,
# while camera, backdrop and lights remain editable in the .blend only.
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type in ('MESH','ARMATURE') and o!=backdrop:
        o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'dooji-motions.glb'),export_format='GLB',
    use_selection=True,export_animations=True,export_animation_mode='ACTIONS',
    export_anim_slide_to_zero=True,export_force_sampling=True,export_frame_range=False,
    export_skins=True,export_materials='EXPORT',export_cameras=False,export_lights=False,
    export_extras=True,export_yup=True)
triangles=0
for o in scene.objects:
    if o.type=='MESH' and o!=backdrop:
        o.data.calc_loop_triangles()
        triangles+=len(o.data.loop_triangles)
manifest={
    'name':'Dooji local Blender motion prototype','version':1,
    'generator':'scripts/build-dooji.py','externalUploads':False,'paidGeneration':False,
    'reference':'../concepts/2026-09-17/dooji-b-cheeky-v1.png',
    'clips':[{'name':k,'seconds':round(actions[k].frame_range[1]/24-1/24,3)} for k in CLIPS],
    'triangles':triangles,'bones':len(rig.pose.bones),'glbBytes':(OUT/'dooji-motions.glb').stat().st_size,
    'notes':['Original simplified clay-style interpretation, not a reconstruction of the furry concept.',
             'Rigid-weighted segmented rig; no facial blendshapes or hair simulation.',
             'Virtual soil patch only. Real-world occlusion and native AR playback need device QA.',
             'Capsule content is not included. Animations do not grant permission to open anything.']}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
# Generated metadata above is build output, not a hand-edited source document.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'dooji-motions.blend'))
scene.render.resolution_x=1000
scene.render.resolution_y=1000
if args.render=='hero':
    rig.animation_data.action=actions['Bury']
    scene.frame_set(1)
    scene.cycles.samples=48
    scene.render.filepath=str(PREVIEW/'dooji-hero.png')
    bpy.ops.render.render(write_still=True)
    for name,frame,label in [('Bury',73,'bury'),('Retrieve',112,'retrieve'),('LockedDisappointed',54,'locked')]:
        rig.animation_data.action=actions[name]
        scene.frame_set(frame)
        scene.render.resolution_x=720
        scene.render.resolution_y=720
        scene.render.filepath=str(PREVIEW/(label+'-keyframe.png'))
        bpy.ops.render.render(write_still=True)
elif args.render=='movies':
    scene.render.resolution_x=480
    scene.render.resolution_y=480
    scene.cycles.samples=12
    for name,label in [('Bury','bury'),('Retrieve','retrieve'),('LockedDisappointed','locked')]:
        rig.animation_data.action=actions[name]
        target=PREVIEW/label
        target.mkdir(exist_ok=True)
        for frame in range(1,round(CLIPS[name]*24)+2,2):
            scene.frame_set(frame)
            scene.render.filepath=str(target/('%04d.png'%((frame-1)//2)))
            bpy.ops.render.render(write_still=True)
print('DOOJI_BUILD_OK '+json.dumps(manifest))
