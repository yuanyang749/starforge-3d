import json
import math
import os
import struct
import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

WORKSPACE_ROOT = "/Users/delroy/Documents/Playground/test001/starforge-3d"
OUT_GLB = os.path.join(WORKSPACE_ROOT, "public", "models", "ship_morph.glb")
SCRATCH_DIR = "/Users/delroy/.gemini/antigravity/brain/21d0c387-d814-4ae9-b900-0f5a403d60ae/scratch"
OUT_BLEND = os.path.join(SCRATCH_DIR, "valkyrie_a103.blend")

BONE_DEFS = [
    ("Root", None, (0.0, 0.0, 0.0)),
    ("Canopy", "Root", (0.0, 1.08, 0.34)),
    ("MissileBay", "Root", (0.0, -0.78, 0.33)),
    ("Wing_L", "Root", (-0.68, -0.02, 0.02)),
    ("Wing_R", "Root", (0.68, -0.02, 0.02)),
    ("WingtipFin_L", "Wing_L", (-2.20, -0.58, 0.02)),
    ("WingtipFin_R", "Wing_R", (2.20, -0.58, 0.02)),
    ("Railgun_L", "Root", (-0.90, 0.45, -0.11)),
    ("Railgun_R", "Root", (0.90, 0.45, -0.11)),
    ("Canard_L", "Root", (-0.44, 1.30, 0.03)),
    ("Canard_R", "Root", (0.44, 1.30, 0.03)),
    ("TailFin_L", "Root", (-0.48, -1.24, 0.19)),
    ("TailFin_R", "Root", (0.48, -1.24, 0.19)),
    ("Thruster_L", "Root", (-0.42, -1.66, -0.01)),
    ("Thruster_R", "Root", (0.42, -1.66, -0.01)),
]


def clear_scene():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in [
        bpy.data.meshes,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.actions,
        bpy.data.lights,
        bpy.data.cameras,
        bpy.data.images,
    ]:
        for item in list(col):
            col.remove(item)


def make_mat(name, base_color, metallic=0.5, roughness=0.3, emission_color=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission_color is not None and emission_strength > 0.0:
        bsdf.inputs["Emission Color"].default_value = emission_color
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def add_loft_mesh(name, stations, mat, cap_ends=True):
    """Create a closed smooth-shaded hard-surface loft from ordered ring stations."""
    bm = bmesh.new()
    rings = []
    for st in stations:
        rings.append([bm.verts.new(Vector(pt)) for pt in st])

    n_pts = len(rings[0])
    for r_i in range(len(rings) - 1):
        r0 = rings[r_i]
        r1 = rings[r_i + 1]
        for j in range(n_pts):
            jn = (j + 1) % n_pts
            try:
                bm.faces.new((r0[j], r0[jn], r1[jn], r1[j]))
            except ValueError:
                pass

    if cap_ends:
        try:
            bm.faces.new(list(reversed(rings[0])))
        except ValueError:
            pass
        try:
            bm.faces.new(rings[-1])
        except ValueError:
            pass

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def make_cube_part(name, loc, scale, mat, rot=(0.0, 0.0, 0.0), bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(mat)
    return obj, bevel


def make_cyl_part(name, verts, r1, r2, depth, loc, mat, rot=(0.0, 0.0, 0.0), bevel=0.008):
    bpy.ops.mesh.primitive_cone_add(
        vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    return obj, bevel


def bake_and_tag(obj, mat, bone_name, parts_list, bevel_width=0.012, bevel_segs=2, edge_split=True):
    if len(obj.data.materials) == 0:
        obj.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.shade_smooth()
    if bevel_width > 0.0:
        bev = obj.modifiers.new("Bevel", "BEVEL")
        bev.width = bevel_width
        bev.segments = bevel_segs
        bev.limit_method = "ANGLE"
        bev.angle_limit = math.radians(32)
        bpy.ops.object.modifier_apply(modifier=bev.name)
    if edge_split:
        es = obj.modifiers.new("EdgeSplit", "EDGE_SPLIT")
        es.split_angle = math.radians(40)
        bpy.ops.object.modifier_apply(modifier=es.name)

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()

    vg = obj.vertex_groups.new(name=bone_name)
    vg.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    obj.select_set(False)
    parts_list.append(obj)
    return obj


def chine_ring(y, rx_ch, rx_top, rx_bot, z_top, z_ch, z_bot):
    """8-point chined stealth aircraft cross-section ordered counter-clockwise looking from +Y."""
    return [
        (0.0, y, z_top),
        (rx_top, y, z_top * 0.88 + z_ch * 0.12),
        (rx_ch, y, z_ch),
        (rx_bot, y, z_bot * 0.82 + z_ch * 0.18),
        (0.0, y, z_bot),
        (-rx_bot, y, z_bot * 0.82 + z_ch * 0.18),
        (-rx_ch, y, z_ch),
        (-rx_top, y, z_top * 0.88 + z_ch * 0.12),
    ]


def mirror_copy(src_obj, bone_r, parts_list):
    """Duplicate a left-side part across X=0 and tag with right-side bone."""
    copy_obj = src_obj.copy()
    copy_obj.data = src_obj.data.copy()
    copy_obj.name = src_obj.name.replace("_L", "_R")
    bpy.context.scene.collection.objects.link(copy_obj)

    bm = bmesh.new()
    bm.from_mesh(copy_obj.data)
    for v in bm.verts:
        v.co.x = -v.co.x
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(copy_obj.data)
    bm.free()

    copy_obj.vertex_groups.clear()
    vg = copy_obj.vertex_groups.new(name=bone_r)
    vg.add(list(range(len(copy_obj.data.vertices))), 1.0, "REPLACE")
    parts_list.append(copy_obj)
    return copy_obj


def build_valkyrie_geometry():
    mats = {
        "pearl": make_mat("Mat_ValkyriePearl", (0.86, 0.90, 0.95, 1.0), metallic=0.48, roughness=0.26),
        "carbon": make_mat("Mat_StealthCarbon", (0.13, 0.17, 0.24, 1.0), metallic=0.78, roughness=0.32),
        "crimson": make_mat(
            "Mat_ValkyrieCrimson",
            (0.88, 0.11, 0.19, 1.0),
            metallic=0.45,
            roughness=0.24,
            emission_color=(0.45, 0.03, 0.07, 1.0),
            emission_strength=0.35,
        ),
        "alloy": make_mat("Mat_BrushedAlloy", (0.62, 0.68, 0.76, 1.0), metallic=0.88, roughness=0.22),
        "glass": make_mat(
            "Mat_CanopyGlass",
            (0.05, 0.24, 0.42, 1.0),
            metallic=0.25,
            roughness=0.06,
            emission_color=(0.04, 0.34, 0.56, 1.0),
            emission_strength=0.75,
        ),
        "plasma": make_mat(
            "Mat_ThrusterPlasma",
            (1.0, 0.26, 0.36, 1.0),
            metallic=0.05,
            roughness=0.12,
            emission_color=(1.0, 0.20, 0.34, 1.0),
            emission_strength=4.2,
        ),
        "cyan": make_mat(
            "Mat_HoloCyan",
            (0.15, 0.95, 1.0, 1.0),
            metallic=0.05,
            roughness=0.15,
            emission_color=(0.05, 0.92, 1.0, 1.0),
            emission_strength=3.6,
        ),
    }

    parts = []

    # -------------------- 1. FUSELAGE & ROOT STRUCTURES --------------------
    # 9-station chined stealth fuselage (+Y nose -> -Y twin nacelle spine)
    fuse_stations = [
        chine_ring(2.44, 0.025, 0.015, 0.015, 0.015, 0.0, -0.015),
        chine_ring(2.10, 0.17, 0.09, 0.11, 0.10, 0.01, -0.08),
        chine_ring(1.62, 0.36, 0.19, 0.25, 0.18, 0.03, -0.14),
        chine_ring(1.06, 0.54, 0.28, 0.40, 0.29, 0.04, -0.19),
        chine_ring(0.45, 0.78, 0.42, 0.56, 0.32, 0.03, -0.22),
        chine_ring(-0.20, 0.80, 0.52, 0.62, 0.31, 0.02, -0.22),
        chine_ring(-0.88, 0.74, 0.54, 0.60, 0.30, 0.02, -0.20),
        chine_ring(-1.38, 0.64, 0.46, 0.52, 0.23, 0.01, -0.16),
        chine_ring(-1.66, 0.54, 0.38, 0.44, 0.14, -0.01, -0.13),
    ]
    fuse_obj = add_loft_mesh("Valkyrie_Fuselage", fuse_stations, mats["pearl"])
    bake_and_tag(fuse_obj, mats["pearl"], "Root", parts, bevel_width=0.010, bevel_segs=2)

    # Dark armored belly keel pan under the fuselage
    belly_stations = [
        chine_ring(2.05, 0.13, 0.07, 0.08, -0.03, -0.06, -0.11),
        chine_ring(1.20, 0.35, 0.18, 0.24, -0.08, -0.14, -0.24),
        chine_ring(0.25, 0.48, 0.26, 0.34, -0.10, -0.17, -0.28),
        chine_ring(-0.75, 0.48, 0.28, 0.32, -0.09, -0.16, -0.25),
        chine_ring(-1.50, 0.36, 0.22, 0.24, -0.06, -0.12, -0.18),
    ]
    belly_obj = add_loft_mesh("Valkyrie_BellyArmor", belly_stations, mats["carbon"])
    bake_and_tag(belly_obj, mats["carbon"], "Root", parts, bevel_width=0.010, bevel_segs=2)

    # Dorsal crimson spine ridge & twin engine nacelle cowlings
    spine_obj, b = make_cube_part("Valkyrie_SpineCrest", (0.0, -0.45, 0.31), (0.20, 1.35, 0.07), mats["crimson"])
    bake_and_tag(spine_obj, mats["crimson"], "Root", parts, bevel_width=b)

    radome_tip, b = make_cyl_part(
        "Valkyrie_NoseSensor",
        8,
        0.085,
        0.012,
        0.34,
        (0.0, 2.34, 0.0),
        mats["carbon"],
        rot=(-math.pi * 0.5, 0.0, math.pi / 8),
    )
    bake_and_tag(radome_tip, mats["carbon"], "Root", parts, bevel_width=0.004)

    chin_sensor, b = make_cube_part("Valkyrie_ChinGlow", (0.0, 1.72, -0.16), (0.10, 0.46, 0.045), mats["cyan"])
    bake_and_tag(chin_sensor, mats["cyan"], "Root", parts, bevel_width=0.006)

    # Cockpit interior tub + armored pilot seat + holo HUD (revealed when Canopy opens!)
    cockpit_tub, _ = make_cube_part("Valkyrie_CockpitTub", (0.0, 0.64, 0.25), (0.38, 0.80, 0.14), mats["carbon"])
    bake_and_tag(cockpit_tub, mats["carbon"], "Root", parts, bevel_width=0.01)

    seat_back, _ = make_cube_part(
        "Valkyrie_PilotHeadrest", (0.0, 0.46, 0.36), (0.22, 0.14, 0.22), mats["carbon"], rot=(math.radians(-18), 0, 0)
    )
    bake_and_tag(seat_back, mats["carbon"], "Root", parts, bevel_width=0.01)

    hud_glass, _ = make_cube_part(
        "Valkyrie_CockpitHUD", (0.0, 0.88, 0.37), (0.22, 0.025, 0.13), mats["cyan"], rot=(math.radians(28), 0, 0)
    )
    bake_and_tag(hud_glass, mats["cyan"], "Root", parts, bevel_width=0.004)

    # Dorsal swarm missile bay tub + 6 exposed micro-missiles inside (revealed when MissileBay opens!)
    bay_tub, _ = make_cube_part("Valkyrie_BayTub", (0.0, -0.44, 0.27), (0.48, 0.64, 0.11), mats["carbon"])
    bake_and_tag(bay_tub, mats["carbon"], "Root", parts, bevel_width=0.008)

    for mx in (-0.14, 0.0, 0.14):
        for my in (-0.58, -0.32):
            m_body, _ = make_cyl_part(
                f"Valkyrie_PodMissile_{mx:.2f}_{my:.2f}",
                8,
                0.045,
                0.045,
                0.18,
                (mx, my, 0.31),
                mats["alloy"],
                rot=(-math.pi * 0.5, 0, 0),
            )
            bake_and_tag(m_body, mats["alloy"], "Root", parts, bevel_width=0.003)

            m_tip, _ = make_cyl_part(
                f"Valkyrie_PodTip_{mx:.2f}_{my:.2f}",
                8,
                0.045,
                0.008,
                0.08,
                (mx, my + 0.12, 0.31),
                mats["plasma"],
                rot=(-math.pi * 0.5, 0, 0),
            )
            bake_and_tag(m_tip, mats["plasma"], "Root", parts, bevel_width=0.002)

    # Twin side supersonic intakes (left -> mirrored to right under Root)
    intake_stations = [
        chine_ring(0.92, 0.22, 0.16, 0.18, 0.14, 0.0, -0.14),
        chine_ring(0.45, 0.24, 0.18, 0.19, 0.16, 0.0, -0.15),
        chine_ring(-0.20, 0.22, 0.17, 0.18, 0.15, 0.0, -0.14),
        chine_ring(-0.90, 0.20, 0.15, 0.16, 0.12, 0.0, -0.11),
        chine_ring(-1.52, 0.24, 0.18, 0.18, 0.14, -0.01, -0.13),
    ]
    # Shift intake centerline to (-0.64, y, 0.01) for left side nacelle/intake trunk
    shifted_intake = [
        [(x - 0.54, y, z + 0.02) for (x, y, z) in ring] for ring in intake_stations
    ]
    intake_l = add_loft_mesh("Valkyrie_Intake_L", shifted_intake, mats["carbon"])
    bake_and_tag(intake_l, mats["carbon"], "Root", parts, bevel_width=0.008)
    mirror_copy(intake_l, "Root", parts)

    intake_lip_l, _ = make_cube_part(
        "Valkyrie_IntakeLip_L", (-0.68, 0.90, 0.02), (0.34, 0.12, 0.25), mats["alloy"], rot=(0, 0, math.radians(-16))
    )
    bake_and_tag(intake_lip_l, mats["alloy"], "Root", parts, bevel_width=0.010)
    mirror_copy(intake_lip_l, "Root", parts)

    intake_stripe_l, _ = make_cube_part(
        "Valkyrie_IntakeStripe_L", (-0.54, 0.0, 0.18), (0.20, 1.35, 0.055), mats["crimson"]
    )
    bake_and_tag(intake_stripe_l, mats["crimson"], "Root", parts, bevel_width=0.008)
    mirror_copy(intake_stripe_l, "Root", parts)

    # -------------------- 2. ARTICULATED CANOPY (Hinge y=+1.08, z=+0.34) --------------------
    canopy_stations = [
        chine_ring(1.08, 0.11, 0.06, 0.10, 0.36, 0.33, 0.30),
        chine_ring(0.86, 0.21, 0.12, 0.20, 0.54, 0.41, 0.30),
        chine_ring(0.55, 0.22, 0.13, 0.21, 0.56, 0.42, 0.30),
        chine_ring(0.24, 0.16, 0.09, 0.15, 0.45, 0.36, 0.29),
    ]
    canopy_glass = add_loft_mesh("Valkyrie_CanopyGlass", canopy_stations, mats["glass"])
    bake_and_tag(canopy_glass, mats["glass"], "Canopy", parts, bevel_width=0.010, bevel_segs=2)

    canopy_arch, _ = make_cube_part("Valkyrie_CanopyArch", (0.0, 0.62, 0.34), (0.39, 0.86, 0.06), mats["carbon"])
    bake_and_tag(canopy_arch, mats["carbon"], "Canopy", parts, bevel_width=0.010)

    canopy_rib, _ = make_cube_part("Valkyrie_CanopySpineTrim", (0.0, 0.92, 0.44), (0.09, 0.34, 0.055), mats["crimson"], rot=(math.radians(-26), 0, 0))
    bake_and_tag(canopy_rib, mats["crimson"], "Canopy", parts, bevel_width=0.008)

    # -------------------- 3. ARTICULATED MISSILE BAY HATCH (Hinge y=-0.78, z=+0.33) --------------------
    bay_hatch, _ = make_cube_part("Valkyrie_MissileBayHatch", (0.0, -0.44, 0.345), (0.50, 0.68, 0.055), mats["pearl"])
    bake_and_tag(bay_hatch, mats["pearl"], "MissileBay", parts, bevel_width=0.010)

    bay_trim, _ = make_cube_part("Valkyrie_MissileBayTrim", (0.0, -0.44, 0.37), (0.26, 0.56, 0.03), mats["crimson"])
    bake_and_tag(bay_trim, mats["crimson"], "MissileBay", parts, bevel_width=0.006)

    # -------------------- 4. VARIABLE-SWEEP WINGS & WINGTIP FINS (Wing_L -> mirrored Wing_R) --------------------
    def wing_section(x_span, y_le, y_te, z_c, thick):
        y_mid = y_le * 0.62 + y_te * 0.38
        return [
            (x_span, y_le, z_c),
            (x_span, y_mid, z_c + thick),
            (x_span, y_te, z_c),
            (x_span, y_mid, z_c - thick * 0.85),
        ]

    # Tapered forward-edge swept diamond-airfoil wing extending from x=-0.62 out to x=-2.24
    wing_stations_l = [
        wing_section(-0.62, 0.52, -0.78, 0.04, 0.095),
        wing_section(-1.05, 0.32, -0.70, 0.035, 0.080),
        wing_section(-1.60, 0.04, -0.62, 0.025, 0.062),
        wing_section(-2.22, -0.26, -0.64, 0.020, 0.046),
    ]
    wing_main_l = add_loft_mesh("Valkyrie_WingMain_L", wing_stations_l, mats["pearl"])
    bake_and_tag(wing_main_l, mats["pearl"], "Wing_L", parts, bevel_width=0.008)
    mirror_copy(wing_main_l, "Wing_R", parts)

    # Crimson swept leading-edge predator armor chevron & cyan wing chord energy conduit
    chevron_stations_l = [
        wing_section(-0.74, 0.49, 0.25, 0.095, 0.028),
        wing_section(-1.45, 0.14, -0.08, 0.075, 0.024),
        wing_section(-2.14, -0.20, -0.36, 0.055, 0.018),
    ]
    wing_chev_l = add_loft_mesh("Valkyrie_WingChevron_L", chevron_stations_l, mats["crimson"])
    bake_and_tag(wing_chev_l, mats["crimson"], "Wing_L", parts, bevel_width=0.005)
    mirror_copy(wing_chev_l, "Wing_R", parts)

    vein_l, _ = make_cube_part(
        "Valkyrie_WingVein_L",
        (-1.45, -0.26, 0.068),
        (1.18, 0.075, 0.038),
        mats["cyan"],
        rot=(0, math.radians(-1.2), math.radians(22)),
    )
    bake_and_tag(vein_l, mats["cyan"], "Wing_L", parts, bevel_width=0.005)
    mirror_copy(vein_l, "Wing_R", parts)

    hinge_cuff_l, _ = make_cyl_part(
        "Valkyrie_WingPivotCollar_L", 12, 0.23, 0.21, 0.18, (-0.70, -0.02, 0.03), mats["alloy"]
    )
    bake_and_tag(hinge_cuff_l, mats["alloy"], "Wing_L", parts, bevel_width=0.008)
    mirror_copy(hinge_cuff_l, "Wing_R", parts)

    # Under-wing micro-missile pylon pod
    pylon_l, _ = make_cube_part("Valkyrie_WingPylon_L", (-1.42, -0.18, -0.09), (0.14, 0.56, 0.13), mats["carbon"])
    bake_and_tag(pylon_l, mats["carbon"], "Wing_L", parts, bevel_width=0.008)
    mirror_copy(pylon_l, "Wing_R", parts)

    pylon_nose_l, _ = make_cyl_part(
        "Valkyrie_WingPodTip_L", 8, 0.065, 0.012, 0.18, (-1.42, 0.18, -0.10), mats["crimson"], rot=(-math.pi * 0.5, 0, 0)
    )
    bake_and_tag(pylon_nose_l, mats["crimson"], "Wing_L", parts, bevel_width=0.003)
    mirror_copy(pylon_nose_l, "Wing_R", parts)

    # Split folding Wingtip Fin (bone WingtipFin_L at x=-2.20 -> WingtipFin_R at x=+2.20)
    tip_stations_l = [
        wing_section(-2.18, -0.22, -0.68, 0.02, 0.042),
        wing_section(-2.52, -0.45, -0.92, 0.05, 0.030),
        wing_section(-2.68, -0.62, -1.04, 0.07, 0.018),
    ]
    tip_blade_l = add_loft_mesh("Valkyrie_WingtipBlade_L", tip_stations_l, mats["carbon"])
    bake_and_tag(tip_blade_l, mats["carbon"], "WingtipFin_L", parts, bevel_width=0.006)
    mirror_copy(tip_blade_l, "WingtipFin_R", parts)

    tip_trim_l, _ = make_cube_part(
        "Valkyrie_WingtipTrim_L",
        (-2.44, -0.58, 0.072),
        (0.42, 0.10, 0.032),
        mats["crimson"],
        rot=(0, math.radians(-5), math.radians(32)),
    )
    bake_and_tag(tip_trim_l, mats["crimson"], "WingtipFin_L", parts, bevel_width=0.004)
    mirror_copy(tip_trim_l, "WingtipFin_R", parts)

    tip_glow_l, _ = make_cube_part(
        "Valkyrie_WingtipGlow_L",
        (-2.65, -0.84, 0.07),
        (0.06, 0.34, 0.045),
        mats["plasma"],
    )
    bake_and_tag(tip_glow_l, mats["plasma"], "WingtipFin_L", parts, bevel_width=0.004)
    mirror_copy(tip_glow_l, "WingtipFin_R", parts)

    # -------------------- 5. UNDER-WING MAGNETIC RAILGUNS (Railgun_L -> Railgun_R) --------------------
    rg_breech_l, _ = make_cube_part("Valkyrie_RailgunBreech_L", (-0.90, 0.22, -0.12), (0.17, 0.64, 0.14), mats["carbon"])
    bake_and_tag(rg_breech_l, mats["carbon"], "Railgun_L", parts, bevel_width=0.010)
    mirror_copy(rg_breech_l, "Railgun_R", parts)

    for rz, rname in [(-0.078, "Top"), (-0.162, "Bot")]:
        rail_l, _ = make_cube_part(
            f"Valkyrie_Railgun{rname}_L", (-0.90, 0.80, rz), (0.11, 0.92, 0.036), mats["alloy"]
        )
        bake_and_tag(rail_l, mats["alloy"], "Railgun_L", parts, bevel_width=0.006)
        mirror_copy(rail_l, "Railgun_R", parts)

    rg_core_l, _ = make_cube_part("Valkyrie_RailgunCore_L", (-0.90, 0.78, -0.12), (0.055, 0.86, 0.044), mats["cyan"])
    bake_and_tag(rg_core_l, mats["cyan"], "Railgun_L", parts, bevel_width=0.004)
    mirror_copy(rg_core_l, "Railgun_R", parts)

    rg_collar_l, _ = make_cube_part("Valkyrie_RailgunCollar_L", (-0.90, 0.98, -0.12), (0.145, 0.14, 0.125), mats["carbon"])
    bake_and_tag(rg_collar_l, mats["carbon"], "Railgun_L", parts, bevel_width=0.008)
    mirror_copy(rg_collar_l, "Railgun_R", parts)

    rg_stripe_l, _ = make_cube_part("Valkyrie_RailgunStripe_L", (-0.90, 0.56, -0.05), (0.075, 0.34, 0.025), mats["crimson"])
    bake_and_tag(rg_stripe_l, mats["crimson"], "Railgun_L", parts, bevel_width=0.004)
    mirror_copy(rg_stripe_l, "Railgun_R", parts)

    # -------------------- 6. FULL-MOVING STEALTH CANARDS (Canard_L -> Canard_R) --------------------
    canard_stations_l = [
        wing_section(-0.42, 1.48, 1.04, 0.03, 0.036),
        wing_section(-0.74, 1.24, 0.96, 0.04, 0.024),
        wing_section(-0.98, 1.02, 0.86, 0.05, 0.016),
    ]
    canard_l = add_loft_mesh("Valkyrie_Canard_L", canard_stations_l, mats["crimson"])
    bake_and_tag(canard_l, mats["crimson"], "Canard_L", parts, bevel_width=0.005)
    mirror_copy(canard_l, "Canard_R", parts)

    canard_cuff_l, _ = make_cube_part("Valkyrie_CanardRoot_L", (-0.44, 1.26, 0.03), (0.14, 0.30, 0.085), mats["carbon"])
    bake_and_tag(canard_cuff_l, mats["carbon"], "Canard_L", parts, bevel_width=0.006)
    mirror_copy(canard_cuff_l, "Canard_R", parts)

    # -------------------- 7. CANTED TWIN V-TAILS (TailFin_L -> TailFin_R) --------------------
    def tail_section(z_h, y_le, y_te, half_thick, cant_shift):
        y_m = y_le * 0.60 + y_te * 0.40
        cx = -0.48 - cant_shift
        return [
            (cx, y_le, z_h),
            (cx - half_thick, y_m, z_h),
            (cx, y_te, z_h),
            (cx + half_thick, y_m, z_h),
        ]

    tail_stations_l = [
        tail_section(0.18, -0.92, -1.52, 0.042, 0.0),
        tail_section(0.48, -1.16, -1.62, 0.032, 0.16),
        tail_section(0.76, -1.42, -1.72, 0.020, 0.31),
    ]
    tail_l = add_loft_mesh("Valkyrie_TailFin_L", tail_stations_l, mats["pearl"])
    bake_and_tag(tail_l, mats["pearl"], "TailFin_L", parts, bevel_width=0.006)
    mirror_copy(tail_l, "TailFin_R", parts)

    tail_crest_l, _ = make_cube_part(
        "Valkyrie_TailCrest_L", (-0.79, -1.56, 0.74), (0.055, 0.34, 0.095), mats["crimson"], rot=(math.radians(8), math.radians(-28), 0)
    )
    bake_and_tag(tail_crest_l, mats["crimson"], "TailFin_L", parts, bevel_width=0.006)
    mirror_copy(tail_crest_l, "TailFin_R", parts)

    tail_strobe_l, _ = make_cube_part("Valkyrie_TailStrobe_L", (-0.82, -1.69, 0.78), (0.045, 0.08, 0.055), mats["cyan"])
    bake_and_tag(tail_strobe_l, mats["cyan"], "TailFin_L", parts, bevel_width=0.004)
    mirror_copy(tail_strobe_l, "TailFin_R", parts)

    # -------------------- 8. VECTORING AFTERBURNER THRUSTERS (Thruster_L -> Thruster_R) --------------------
    nozzle_ring_l, _ = make_cyl_part(
        "Valkyrie_NozzleRing_L", 12, 0.24, 0.22, 0.26, (-0.42, -1.66, -0.01), mats["carbon"], rot=(math.pi * 0.5, 0, 0)
    )
    bake_and_tag(nozzle_ring_l, mats["carbon"], "Thruster_L", parts, bevel_width=0.008)
    mirror_copy(nozzle_ring_l, "Thruster_R", parts)

    # Shroud petals tapering slightly toward rear (-Y): +90deg X puts radius2 at -Y
    nozzle_petals_l, _ = make_cyl_part(
        "Valkyrie_NozzlePetals_L", 8, 0.23, 0.175, 0.34, (-0.42, -1.82, -0.01), mats["alloy"], rot=(math.pi * 0.5, 0, math.pi / 8)
    )
    bake_and_tag(nozzle_petals_l, mats["alloy"], "Thruster_L", parts, bevel_width=0.008)
    mirror_copy(nozzle_petals_l, "Thruster_R", parts)

    # Dark inner recessed nozzle cavity ring
    nozzle_inner_l, _ = make_cyl_part(
        "Valkyrie_NozzleInner_L", 12, 0.165, 0.155, 0.12, (-0.42, -1.94, -0.01), mats["carbon"], rot=(math.pi * 0.5, 0, 0)
    )
    bake_and_tag(nozzle_inner_l, mats["carbon"], "Thruster_L", parts, bevel_width=0.004)
    mirror_copy(nozzle_inner_l, "Thruster_R", parts)

    # Glowing tapered afterburner plasma plume extending cleanly out the rear (-Y)
    plasma_cone_l, _ = make_cyl_part(
        "Valkyrie_AfterburnerFlame_L", 12, 0.13, 0.025, 0.34, (-0.42, -2.02, -0.01), mats["plasma"], rot=(math.pi * 0.5, 0, 0)
    )
    bake_and_tag(plasma_cone_l, mats["plasma"], "Thruster_L", parts, bevel_width=0.004)
    mirror_copy(plasma_cone_l, "Thruster_R", parts)

    plasma_core_l, _ = make_cyl_part(
        "Valkyrie_AfterburnerCore_L", 12, 0.085, 0.015, 0.20, (-0.42, -1.98, -0.01), mats["cyan"], rot=(math.pi * 0.5, 0, 0)
    )
    bake_and_tag(plasma_core_l, mats["cyan"], "Thruster_L", parts, bevel_width=0.003)
    mirror_copy(plasma_core_l, "Thruster_R", parts)

    # -------------------- 9. JOIN INTO SINGLE SKINNED MESH --------------------
    bpy.ops.object.select_all(action="DESELECT")
    hull_base = parts[0]
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = hull_base
    bpy.ops.object.join()
    hull_base.name = "Valkyrie_Hull"
    bpy.ops.object.select_all(action="DESELECT")
    return hull_base


def create_armature_and_skin(hull_obj):
    arm_data = bpy.data.armatures.new("ValkyrieRig")
    arm_obj = bpy.data.objects.new("ValkyrieRig", arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)

    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    created_bones = {}
    for bname, parent_name, (hx, hy, hz) in BONE_DEFS:
        eb = arm_data.edit_bones.new(bname)
        eb.head = Vector((hx, hy, hz))
        eb.tail = Vector((hx, hy + 0.35, hz))
        eb.align_roll(Vector((0.0, 0.0, 1.0)))
        if parent_name:
            eb.parent = created_bones[parent_name]
            eb.use_connect = False
        created_bones[bname] = eb

    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")

    hull_obj.parent = arm_obj
    arm_mod = hull_obj.modifiers.new("Armature", "ARMATURE")
    arm_mod.object = arm_obj
    arm_mod.use_vertex_groups = True

    return arm_obj


def reset_pose(arm_obj):
    for pb in arm_obj.pose.bones:
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)


def key_pose_bone(arm_obj, bone_name, frame, rot_deg=None, loc=None):
    pb = arm_obj.pose.bones[bone_name]
    if loc is not None:
        pb.location = Vector(loc)
        pb.keyframe_insert(data_path="location", frame=frame)
    if rot_deg is not None:
        pb.rotation_euler = Euler(
            (math.radians(rot_deg[0]), math.radians(rot_deg[1]), math.radians(rot_deg[2])), "XYZ"
        )
        pb.keyframe_insert(data_path="rotation_euler", frame=frame)


def push_clip_to_nla(arm_obj, clip_name, start_frame, build_fn):
    arm_obj.animation_data_create()
    reset_pose(arm_obj)
    act = bpy.data.actions.new(name=clip_name)
    arm_obj.animation_data.action = act

    build_fn(arm_obj)

    # Set linear interpolation for smooth scrubbed channels where appropriate; keep Bezier on showcase
    track = arm_obj.animation_data.nla_tracks.new()
    track.name = clip_name
    strip = track.strips.new(clip_name, start_frame, act)
    strip.name = clip_name
    arm_obj.animation_data.action = None


def bake_all_nla_animations(arm_obj):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")

    # 1. hangar_showcase (frames 1..180 seamless loop — touches all 14 child bones)
    def anim_showcase(arm):
        # Smooth preflight choreography: spread -> open canopy & missile bay + deploy railguns -> seal -> swept attack stance -> spread
        wing_frames = [
            (1, 0.0, 24.0, 0.0),
            (55, 0.0, 24.0, 0.24),
            (105, -32.0, 0.0, 0.24),
            (145, -32.0, 0.0, 0.08),
            (180, 0.0, 24.0, 0.0),
        ]
        for fr, sweep, tip_fold, rg_ext in wing_frames:
            key_pose_bone(arm, "Wing_L", fr, rot_deg=(0.0, 0.0, -sweep))
            key_pose_bone(arm, "Wing_R", fr, rot_deg=(0.0, 0.0, sweep))
            key_pose_bone(arm, "WingtipFin_L", fr, rot_deg=(0.0, tip_fold, 0.0))
            key_pose_bone(arm, "WingtipFin_R", fr, rot_deg=(0.0, -tip_fold, 0.0))
            key_pose_bone(arm, "Railgun_L", fr, loc=(0.0, rg_ext, 0.0))
            key_pose_bone(arm, "Railgun_R", fr, loc=(0.0, rg_ext, 0.0))

        hatch_frames = [
            (1, 0.0, 0.0),
            (30, -36.0, 42.0),
            (80, -36.0, 42.0),
            (110, 0.0, 0.0),
            (180, 0.0, 0.0),
        ]
        for fr, can_x, bay_x in hatch_frames:
            key_pose_bone(arm, "Canopy", fr, rot_deg=(can_x, 0.0, 0.0))
            key_pose_bone(arm, "MissileBay", fr, rot_deg=(bay_x, 0.0, 0.0))

        ctrl_frames = [
            (1, 0.0, 0.0, 0.0),
            (45, 14.0, 12.0, -10.0),
            (90, -14.0, -12.0, 10.0),
            (135, 8.0, 8.0, -6.0),
            (180, 0.0, 0.0, 0.0),
        ]
        for fr, pitch_x, yaw_z, vec_x in ctrl_frames:
            key_pose_bone(arm, "Canard_L", fr, rot_deg=(pitch_x, 0.0, 0.0))
            key_pose_bone(arm, "Canard_R", fr, rot_deg=(pitch_x, 0.0, 0.0))
            key_pose_bone(arm, "TailFin_L", fr, rot_deg=(0.0, 0.0, yaw_z))
            key_pose_bone(arm, "TailFin_R", fr, rot_deg=(0.0, 0.0, yaw_z))
            key_pose_bone(arm, "Thruster_L", fr, rot_deg=(vec_x, 0.0, yaw_z * 0.6))
            key_pose_bone(arm, "Thruster_R", fr, rot_deg=(vec_x, 0.0, yaw_z * 0.6))

    push_clip_to_nla(arm_obj, "hangar_showcase", 1, anim_showcase)

    # 2. wing_sweep (ONLY Wing_L/R, WingtipFin_L/R, Railgun_L/R — disjoint from other combat clips)
    def anim_wing_sweep(arm):
        # Frame 1: cruise spread wings (wingtips folded UP 24deg); Frame 60: swept delta (-34deg back) + railguns forward
        for fr, sweep, tip_fold, rg_ext in [(1, 0.0, 24.0, 0.0), (60, -34.0, 0.0, 0.24)]:
            key_pose_bone(arm, "Wing_L", fr, rot_deg=(0.0, 0.0, -sweep))
            key_pose_bone(arm, "Wing_R", fr, rot_deg=(0.0, 0.0, sweep))
            key_pose_bone(arm, "WingtipFin_L", fr, rot_deg=(0.0, tip_fold, 0.0))
            key_pose_bone(arm, "WingtipFin_R", fr, rot_deg=(0.0, -tip_fold, 0.0))
            key_pose_bone(arm, "Railgun_L", fr, loc=(0.0, rg_ext, 0.0))
            key_pose_bone(arm, "Railgun_R", fr, loc=(0.0, rg_ext, 0.0))

    push_clip_to_nla(arm_obj, "wing_sweep", 1, anim_wing_sweep)

    # 3. canopy_bay (ONLY Canopy & MissileBay)
    def anim_canopy_bay(arm):
        for fr, can_x, bay_x in [(1, 0.0, 0.0), (60, -38.0, 44.0)]:
            key_pose_bone(arm, "Canopy", fr, rot_deg=(can_x, 0.0, 0.0))
            key_pose_bone(arm, "MissileBay", fr, rot_deg=(bay_x, 0.0, 0.0))

    push_clip_to_nla(arm_obj, "canopy_bay", 1, anim_canopy_bay)

    # 4. control_roll (ONLY TailFin_L/R — 100% disjoint!)
    def anim_control_roll(arm):
        for fr, rz in [(1, -16.0), (30, 0.0), (60, 16.0)]:
            key_pose_bone(arm, "TailFin_L", fr, rot_deg=(0.0, 0.0, rz))
            key_pose_bone(arm, "TailFin_R", fr, rot_deg=(0.0, 0.0, rz))

    push_clip_to_nla(arm_obj, "control_roll", 1, anim_control_roll)

    # 5. control_pitch (ONLY Canard_L/R & Thruster_L/R — 100% disjoint!)
    def anim_control_pitch(arm):
        for fr, can_x, thr_x in [(1, -18.0, 14.0), (30, 0.0, 0.0), (60, 18.0, -14.0)]:
            key_pose_bone(arm, "Canard_L", fr, rot_deg=(can_x, 0.0, 0.0))
            key_pose_bone(arm, "Canard_R", fr, rot_deg=(can_x, 0.0, 0.0))
            key_pose_bone(arm, "Thruster_L", fr, rot_deg=(thr_x, 0.0, 0.0))
            key_pose_bone(arm, "Thruster_R", fr, rot_deg=(thr_x, 0.0, 0.0))

    push_clip_to_nla(arm_obj, "control_pitch", 1, anim_control_pitch)

    # 6. railgun_recoil (snappy railgun kickback cycle)
    def anim_recoil(arm):
        for fr, yoff in [(1, 0.24), (5, 0.06), (20, 0.24)]:
            key_pose_bone(arm, "Railgun_L", fr, loc=(0.0, yoff, 0.0))
            key_pose_bone(arm, "Railgun_R", fr, loc=(0.0, yoff, 0.0))

    push_clip_to_nla(arm_obj, "railgun_recoil", 1, anim_recoil)

    reset_pose(arm_obj)
    bpy.ops.object.mode_set(mode="OBJECT")


def setup_studio_lights():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    if hasattr(scene.cycles, "use_denoising"):
        scene.cycles.use_denoising = False
    scene.render.resolution_x = 640
    scene.render.resolution_y = 480
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"

    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.04, 0.08, 0.14, 1.0)
        bg.inputs["Strength"].default_value = 0.95

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.lens = 42
    cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    def add_light(name, ltype, loc, energy, color=(1.0, 1.0, 1.0), size=4.0):
        ldata = bpy.data.lights.new(name=name, type=ltype)
        ldata.energy = energy
        ldata.color = color
        if hasattr(ldata, "size"):
            ldata.size = size
        lobj = bpy.data.objects.new(name, ldata)
        scene.collection.objects.link(lobj)
        lobj.location = loc
        d = Vector((0.0, 0.1, 0.0)) - Vector(loc)
        lobj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

    add_light("KeyLight", "AREA", (4.8, 3.8, 4.5), 550.0, (1.0, 0.97, 0.92), size=4.0)
    add_light("RimCyan", "AREA", (-4.8, -3.2, 2.8), 420.0, (0.45, 0.88, 1.0), size=3.5)
    add_light("FillWarm", "AREA", (0.0, -4.5, -2.5), 260.0, (1.0, 0.72, 0.55), size=3.0)
    return cam_obj


def point_cam(cam_obj, loc, target=(0.0, 0.1, 0.05)):
    cam_obj.location = loc
    d = Vector(target) - Vector(loc)
    cam_obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def render_previews(arm_obj):
    cam_obj = setup_studio_lights()
    os.makedirs(SCRATCH_DIR, exist_ok=True)
    scene = bpy.context.scene

    # Pose 1: Open stance at hangar_showcase frame 55 (wings spread, canopy & missile bay open, railguns extended)
    reset_pose(arm_obj)
    for tr in arm_obj.animation_data.nla_tracks:
        tr.mute = tr.name != "hangar_showcase"
    scene.frame_set(55)
    bpy.context.view_layer.update()
    point_cam(cam_obj, (4.3, 4.5, 2.25))
    scene.render.filepath = os.path.join(SCRATCH_DIR, "preview_valkyrie_front_open.png")
    bpy.ops.render.render(write_still=True)

    # Pose 2 & 3: Supersonic swept delta attack stance (wing_sweep frame 60, canopy & bay closed!)
    reset_pose(arm_obj)
    for tr in arm_obj.animation_data.nla_tracks:
        tr.mute = tr.name != "wing_sweep"
    scene.frame_set(60)
    bpy.context.view_layer.update()
    point_cam(cam_obj, (-4.1, -4.6, 2.2))
    scene.render.filepath = os.path.join(SCRATCH_DIR, "preview_valkyrie_rear_swept.png")
    bpy.ops.render.render(write_still=True)

    point_cam(cam_obj, (0.0, -0.05, 6.4), target=(0.0, 0.0, 0.0))
    scene.render.filepath = os.path.join(SCRATCH_DIR, "preview_valkyrie_top_swept.png")
    bpy.ops.render.render(write_still=True)

    # Restore all NLA tracks unmuted and reset rest pose for clean export
    for tr in arm_obj.animation_data.nla_tracks:
        tr.mute = False
    scene.frame_set(1)
    reset_pose(arm_obj)
    bpy.context.view_layer.update()


def verify_glb_structure(glb_path):
    with open(glb_path, "rb") as f:
        data = f.read()
    jlen = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20 : 20 + jlen].decode("utf-8"))
    skins = j.get("skins", [])
    anims = j.get("animations", [])
    print(
        f"GLB verify: bytes={len(data)}, skins={len(skins)}, "
        f"joints={len(skins[0]['joints']) if skins else 0}, "
        f"animations={[a.get('name') for a in anims]}"
    )
    assert len(skins) == 1, f"Expected 1 skin, got {len(skins)}"
    assert len(skins[0]["joints"]) == 15, f"Expected 15 joints, got {len(skins[0]['joints'])}"
    assert len(anims) == 6, f"Expected 6 animations, got {len(anims)}"


def main():
    clear_scene()
    hull_obj = build_valkyrie_geometry()
    arm_obj = create_armature_and_skin(hull_obj)
    bake_all_nla_animations(arm_obj)
    render_previews(arm_obj)

    os.makedirs(SCRATCH_DIR, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)

    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    arm_obj.select_set(True)
    hull_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
        export_skins=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_anim_single_armature=True,
        export_anim_slide_to_zero=True,
    )
    verify_glb_structure(OUT_GLB)


if __name__ == "__main__":
    main()
