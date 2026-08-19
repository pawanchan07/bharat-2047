#!/usr/bin/env python3
"""Generate the Future India town state for the prototype."""
import json, copy

N = 32

def tile(x, y, btype='grass', zone='none'):
    return {
        "x": x, "y": y, "zone": zone,
        "building": {
            "type": btype, "level": 1, "population": 0, "jobs": 0,
            "powered": True, "watered": True, "onFire": False,
            "fireProgress": 0, "age": 0, "constructionProgress": 100,
            "abandoned": False
        },
        "landValue": 80, "pollution": 0, "crime": 0, "traffic": 0,
        "hasSubway": False, "hasRailOverlay": False
    }

grid = [[tile(x, y) for x in range(N)] for y in range(N)]

def put(x, y, btype, pop=0, jobs=0):
    grid[y][x] = tile(x, y, btype)
    grid[y][x]["building"]["population"] = pop
    grid[y][x]["building"]["jobs"] = jobs

def put_multi(x, y, btype, size, pop=0, jobs=0):
    """Origin tile carries building; footprint tiles become empty."""
    for dy in range(size):
        for dx in range(size):
            if dx == 0 and dy == 0:
                put(x, y, btype, pop, jobs)
            else:
                put(x + dx, y + dy, 'empty')

# ---- River along the north edge (y = 0..1) ----
water_tiles = []
for y in range(2):
    for x in range(N):
        put(x, y, 'water')
        water_tiles.append({"x": x, "y": y})

# ---- Road network: ring + cross streets ----
H_ROADS = [4, 12, 19, 26]
V_ROADS = [4, 11, 18, 25]
for y in H_ROADS:
    for x in range(4, 26):
        put(x, y, 'road')
for x in V_ROADS:
    for y in range(4, 27):
        put(x, y, 'road')

# ---- Rail line along the south (y=29) with station ----
for x in range(2, 30):
    put(x, 29, 'rail')

# ---- Civic core (block x12..17, y5..11) ----
put_multi(13, 6, 'city_hall', 2, jobs=20)      # Digital Voting Centre
put(16, 6, 'community_center', jobs=8)          # AI Panchayat Kendra
put(16, 8, 'park')
put(12, 6, 'park')
put(12, 8, 'tree')
put(13, 9, 'pond_park')
put(15, 10, 'tree')
put(13, 11 - 1, 'park') if False else None

# ---- Education block (x5..10, y5..11) ----
put_multi(6, 6, 'school', 2, jobs=15)           # National Digital School
put(9, 6, 'tree')
put(6, 9, 'playground_small')
put(8, 9, 'basketball_courts')
put(9, 10, 'tree')

# ---- Health block (x19..24, y5..11) ----
put_multi(20, 6, 'hospital', 2, jobs=25)        # Smart Health Centre
put(23, 6, 'park')
put(20, 9, 'community_garden')
put(23, 9, 'tree')

# ---- Market street & bank (x12..17, y13..18) ----
put_multi(13, 13, 'museum', 3, jobs=18)         # Bank of Bharat (blockchain bank)
put(16, 13, 'shop_small', jobs=4)
put(12, 16, 'shop_small', jobs=4)
put(16, 17, 'shop_medium', jobs=8)
put(12, 17, 'shop_small', jobs=4)

# ---- Residential west (x5..10, y13..18) ----
homes_w = [(5,13),(7,13),(9,13),(5,15),(7,15),(9,15),(5,17),(7,17),(9,17)]
for i,(x,y) in enumerate(homes_w):
    put(x, y, 'house_small' if i % 3 else 'house_medium', pop=6)
put(6,14,'tree'); put(8,16,'tree'); put(10,14,'tree')

# ---- Residential east (x19..24, y13..18) ----
homes_e = [(19,13),(21,13),(23,13),(19,15),(21,15),(23,15),(19,17),(21,17)]
for i,(x,y) in enumerate(homes_e):
    put(x, y, 'house_small' if i % 2 else 'house_medium', pop=6)
put(23,17,'community_garden'); put(20,14,'tree'); put(22,16,'tree')

# ---- Safety block (x5..10, y20..25) ----
put(6, 21, 'police_station', jobs=12)           # AI Safety Command
put(8, 21, 'fire_station', jobs=10)
put(6, 23, 'office_building_small', jobs=8)     # Municipal Smart Ops
put(8, 23, 'park')
put(9, 24, 'tree'); put(5, 24, 'tree')

# ---- Mobility hub (x12..17, y20..25) ----
put_multi(13, 21, 'rail_station', 2, jobs=10)   # Smart Mobility Hub
put(16, 21, 'park')
put(12, 24, 'tree'); put(16, 24, 'tree')

# ---- Farms & utilities east block (x19..24, y20..25) ----
put(19, 21, 'greenhouse_garden', jobs=4)
put(21, 21, 'animal_pens_farm', jobs=4)
put(23, 21, 'greenhouse_garden', jobs=4)
put(19, 23, 'animal_pens_farm', jobs=4)
put(21, 23, 'water_tower')
put(23, 23, 'tree')

# ---- Power & utilities, east margin ----
put_multi(27, 5, 'power_plant', 2, jobs=12)
put(27, 8, 'water_tower')
put(28, 12, 'tree'); put(27, 14, 'greenhouse_garden'); put(29, 16, 'animal_pens_farm')
put(27, 20, 'tree'); put(29, 22, 'tree')

# ---- Riverside promenade (y=2..3) ----
for x in range(3, 29, 3):
    put(x, 2, 'tree')
put(14, 2, 'park'); put(17, 2, 'park'); put(11, 2, 'park')
put(20, 2, 'amphitheater')

# ---- West margin greenery ----
for y in range(5, 27, 4):
    put(2, y, 'tree')
put(2, 13, 'pond_park')

# ---- South margin ----
put(6, 27, 'tree'); put(10, 27, 'park'); put(20, 27, 'tree'); put(24, 27, 'park')
for x in range(3, 29, 5):
    put(x, 31, 'tree')

# ---- Assemble full state from template ----
template = json.load(open('public/example-states/example_state_9.json'))
state = copy.deepcopy(template)
state['id'] = 'future-india-2047'
state['grid'] = grid
state['gridSize'] = N
state['cityName'] = 'Bharat 2047'
state['year'] = 2047
state['month'] = 1
state['day'] = 1
state['tick'] = 0
state['speed'] = 1
state['selectedTool'] = 'select'
state['notifications'] = []
state['advisorMessages'] = []
state['history'] = []
state['disastersEnabled'] = False
state['waterBodies'] = [{"id": "river-0", "name": "Ganga", "type": "lake", "tiles": water_tiles}]
state['stats']['money'] = 1000000
state['stats']['population'] = 1200
# zero-fill service coverage grids at the new size
for k in state.get('services', {}):
    state['services'][k] = [[0 for _ in range(N)] for _ in range(N)]

json.dump(state, open('public/example-states/future_india.json', 'w'))
print('wrote future_india.json,', N, 'x', N)
