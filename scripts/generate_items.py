import json
import os
import re

BASE_DIR = "/Users/bblue/Dev/clicker-shipper/public/assets"

FOLDER_MAP = {
    "resources": "resources",
    "armaments": "armaments",
    "melee": "melee",
    "radioactive": "radioactive",
    "mining": "mining",
    "streetwear": "streetwear",
}

BASE_COSTS = {
    "resources": 10,
    "armaments": 24,
    "melee": 18,
    "radioactive": 32,
    "mining": 15,
    "streetwear": 16,
}

PREFIX_MAP = {
    "resources": "resource",
    "armaments": "arm",
    "melee": "melee",
    "radioactive": "radioactive",
    "mining": "mining",
    "streetwear": "streetwear",
}

ROOT_ORDER = [
    ("resources", "skill-chip", "Resource Systems", "Core materials and components"),
    ("armaments", "skill-ranged", "Ranged Systems", "Advanced armaments and ranged tech"),
    ("melee", "skill-melee", "Melee Systems", "Close-quarters equipment"),
    ("radioactive", "skill-radioactive", "Radioactive Systems", "Hazardous materials and tech"),
    ("mining", "skill-drill", "Mining Systems", "Extraction and drilling equipment"),
    ("streetwear", "skill-character", "Streetwear Systems", "Apparel and character gear"),
]


def list_icons(type_name: str) -> list:
    folder = os.path.join(BASE_DIR, FOLDER_MAP[type_name])
    files = [f for f in os.listdir(folder) if f.endswith(".png")]
    prefix = PREFIX_MAP[type_name]
    pattern = re.compile(r"^" + re.escape(prefix) + r"(\d+)\.png$")
    icons = []
    for file_name in files:
        match = pattern.match(file_name)
        if match:
            icons.append((int(match.group(1)), file_name[:-4]))
    icons.sort(key=lambda x: x[0])
    return [name for _, name in icons]


def make_leaf(type_name: str, icon_name: str, index: int) -> dict:
    return {
        "id": f"item_{type_name}_{index:03d}",
        "name": icon_name,
        "icon": icon_name,
        "type": type_name,
        "cost": BASE_COSTS[type_name] + (index - 1) % 6,
    }


def make_nav_down(type_name: str, level: int, children: list) -> dict:
    return {
        "id": f"nav_{type_name}_down_{level}",
        "name": f"More {type_name.title()}",
        "icon": "skill-down",
        "description": f"More {type_name} items",
        "layers": [
            {"texture": "skill-down", "depth": 3},
            {"texture": "frame", "depth": 2},
        ],
        "children": children,
    }


def build_chain(type_name: str, icons: list, start_index: int = 1, level: int = 1) -> list:
    if len(icons) <= 6:
        return [make_leaf(type_name, icon, start_index + i) for i, icon in enumerate(icons)]

    current = icons[:5]
    remaining = icons[5:]
    next_children = build_chain(type_name, remaining, start_index + 5, level + 1)
    nav_down = make_nav_down(type_name, level, next_children)

    items = [make_leaf(type_name, current[0], start_index)]
    items.append(nav_down)
    items.extend(make_leaf(type_name, current[i], start_index + i) for i in range(1, 5))
    return items


def main() -> None:
    items = []
    total = 0
    for type_name, skill_icon, name, desc in ROOT_ORDER:
        icons = list_icons(type_name)
        total += len(icons)
        children = build_chain(type_name, icons)
        items.append({
            "id": f"nav_{type_name}_root",
            "name": name,
            "icon": skill_icon,
            "description": desc,
            "layers": [
                {"texture": skill_icon, "depth": 3},
                {"texture": "frame", "depth": 2},
            ],
            "children": children,
        })

    out_path = "/Users/bblue/Dev/clicker-shipper/public/data/items.json"
    with open(out_path, "w", encoding="utf-8") as output_file:
        json.dump({"items": items}, output_file, indent=2)
        output_file.write("\n")

    print(f"Wrote items.json with {total} leaf items")


if __name__ == "__main__":
    main()
