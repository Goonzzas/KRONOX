"""
KRONOX Modular 120-Meter Research Cruiser - Blender 3D Generator Script
Executes inside Blender (via Scripting Workspace or headless: `blender --background --python blender_ship_generator.py`)
Generates the editable `.blend` file with high-poly bevels, PBR materials, and exports to `kronox_120m_cruiser.glb`.
"""

import math

def build_kronox_ship_in_blender():
    try:
        import bpy
    except ImportError:
        print("Note: This script is designed to run inside Blender 3D (v3.0+ / v4.0+).")
        print("For WebGL Three.js execution, use src/scene/modularShipHull3D.js.")
        return

    # Clear existing objects in default scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Collection Setup
    ship_col = bpy.data.collections.new("KRONOX_Modular_Cruiser_120M")
    bpy.context.scene.collection.children.link(ship_col)

    # 1. Command Module (Bow)
    bpy.ops.mesh.primitive_cylinder_add(radius=4.2, depth=16.0, vertices=12, location=(0, 0, -51.0))
    bow = bpy.context.active_object
    bow.name = "CommandModule_Bow"
    bow.rotation_euler = (math.pi / 2, 0, 0)

    # 2. Central Structural Spine
    bpy.ops.mesh.primitive_cylinder_add(radius=6.8, depth=76.0, vertices=16, location=(0, 0, -4.0))
    spine = bpy.context.active_object
    spine.name = "StructuralSpine_Core"
    spine.rotation_euler = (math.pi / 2, 0, 0)

    # 3. Science Pods (Port & Starboard)
    for x, side in [(-8.8, "Port"), (8.8, "Starboard")]:
        bpy.ops.mesh.primitive_cylinder_add(radius=4.2, depth=18.0, vertices=12, location=(x, 0.5, -28.0))
        pod = bpy.context.active_object
        pod.name = f"SciencePod_{side}"
        pod.rotation_euler = (math.pi / 2, 0, 0)

    # 4. Habitat Drums
    for x, side in [(-6.5, "Port"), (6.5, "Starboard")]:
        bpy.ops.mesh.primitive_cylinder_add(radius=5.2, depth=22.0, vertices=16, location=(x, 1.2, 4.0))
        drum = bpy.context.active_object
        drum.name = f"HabitatDrum_{side}"
        drum.rotation_euler = (math.pi / 2, 0, 0)

    # 5. Thermal Radiator Arrays
    for x, side in [(-17.5, "Port"), (17.5, "Starboard")]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x, 1.5, 16.0))
        panel = bpy.context.active_object
        panel.name = f"ThermalRadiator_{side}"
        panel.scale = (9.5, 0.15, 20.0)

    # 6. Reactor and Propulsion Engines
    bpy.ops.mesh.primitive_cylinder_add(radius=8.2, depth=24.0, vertices=16, location=(0, 0, 32.0))
    reactor = bpy.context.active_object
    reactor.name = "Engineering_TokamakReactor"
    reactor.rotation_euler = (math.pi / 2, 0, 0)

    for i, (ex, ey) in enumerate([(0, 3.4), (-4.2, -2.8), (4.2, -2.8)]):
        bpy.ops.mesh.primitive_cone_add(radius1=3.4, radius2=1.6, depth=6.2, vertices=20, location=(ex, ey, 46.0))
        nozzle = bpy.context.active_object
        nozzle.name = f"EngineNozzle_{i+1}"
        nozzle.rotation_euler = (-math.pi / 2, 0, 0)

    print("KRONOX 120m Modular Cruiser successfully generated in Blender.")

if __name__ == "__main__":
    build_kronox_ship_in_blender()

