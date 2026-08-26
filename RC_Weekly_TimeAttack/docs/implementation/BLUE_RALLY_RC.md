# Blue Rally RC — Unity implementation

## 결과

파란 랠리 쿠페 콘셉트를 모바일 WebGL용 저폴리 FBX로 구현했다.

![Blender에서 실제 FBX와 같은 메시로 렌더한 Blue Rally RC](blue-rally-rc-blender-preview.png)

- 총 `14,080 triangles`
- Mesh Object `10개`
- 단색 Material `6개`
- 독립 Wheel Object `4개`
- 차체와 별도의 단일 `BoxCollider` 유지
- 플레이어 Wheel 회전과 Front Wheel 조향
- 같은 FBX를 Cyan 반투명 Material로 바꾸는 Ghost

## Mesh objects

| Object | Triangles | 역할 |
|---|---:|---|
| `BodyShell` | 7,504 | 저폴리 차체와 네 개의 넓은 Fender |
| `Canopy` | 728 | 내부를 생략한 Smoked Glass 캐노피 |
| `AeroKit` | 736 | 전후 Bumper, Splitter, Side Skirt |
| `Headlights` | 432 | 단순 Housing과 Lens |
| `RearWing` | 412 | Wing Deck, Post, Accent End Plate |
| `RCDetails` | 1,052 | Body Clip, Mirror, Antenna, Tail Light |
| `Wheel_FL` | 804 | Front Left 독립 회전 Wheel |
| `Wheel_FR` | 804 | Front Right 독립 회전 Wheel |
| `Wheel_RL` | 804 | Rear Left 독립 회전 Wheel |
| `Wheel_RR` | 804 | Rear Right 독립 회전 Wheel |

## Materials

`M_BlueBody`, `M_Graphite`, `M_SmokedGlass`, `M_YellowAccent`, `M_WheelMetal`, `M_LampWhite`만 사용한다. 고해상도 Texture, 실내, 미세 Grille, Normal Map은 사용하지 않는다.

## Files

- Unity FBX: `Assets/_Project/Resources/Vehicles/BlueRallyRC.fbx`
- Blender source: `ArtSource/Vehicles/BlueRallyRC/BlueRallyRC.blend`
- Triangle report: `ArtSource/Vehicles/BlueRallyRC/BlueRallyRC.model-report.json`
- Generator: `Tools/Blender/generate_blue_rally_rc.py`
- FBX validator: `Tools/Blender/validate_blue_rally_fbx.py`

## Regenerate and validate

프로젝트 루트에서 Blender 명령을 실행한다.

```sh
blender --background --python RC_Weekly_TimeAttack/Tools/Blender/generate_blue_rally_rc.py
blender --background --python RC_Weekly_TimeAttack/Tools/Blender/validate_blue_rally_fbx.py
```

Generator는 최종 Triangle 수가 `8,000..15,000` 범위를 벗어나면 실패한다. Validator는 저장된 FBX를 새 Blender 장면으로 다시 가져와 Mesh 이름, Material, 독립 Wheel, Triangle 수와 축 방향을 검사한다.

Unity Editor에서는 FBX 임포트 후 `V01_Sandbox` Play Mode에서 차량과 Ghost의 Material, Wheel 회전 방향, Steering 축을 최종 확인한다. 현재 개발 머신에는 Unity Editor가 없으므로 이 단계는 보류한다.
