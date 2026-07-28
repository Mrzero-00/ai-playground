import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import type { NormalizedRoutePoint } from '../domain/runTracking';
import { colors, radii } from './theme';

interface RunRouteMapProps {
  caption?: string;
  dark?: boolean;
  height?: number;
  path: NormalizedRoutePoint[];
  style?: StyleProp<ViewStyle>;
}

interface MapSize {
  height: number;
  width: number;
}

const MAP_PADDING = 20;
const ROUTE_THICKNESS = 5;

export function RunRouteMap({
  caption = '정확한 좌표 대신 경로 모양만 저장해요.',
  dark = false,
  height = 210,
  path,
  style,
}: RunRouteMapProps) {
  const [mapSize, setMapSize] = useState<MapSize>({
    height,
    width: 0,
  });
  const colorsForMap = dark
    ? {
        background: '#092732',
        caption: '#89AAA5',
        road: 'rgba(255,255,255,0.08)',
        river: 'rgba(48,166,190,0.18)',
        route: colors.orange,
        title: colors.white,
      }
    : {
        background: '#E8F0EC',
        caption: colors.inkMuted,
        road: 'rgba(57,91,82,0.12)',
        river: 'rgba(48,166,190,0.18)',
        route: colors.brandDark,
        title: colors.ink,
      };

  const projectedPoints = useMemo(() => {
    const innerWidth = Math.max(0, mapSize.width - MAP_PADDING * 2);
    const innerHeight = Math.max(0, mapSize.height - MAP_PADDING * 2);

    return path.map((point) => ({
      x: MAP_PADDING + point.x * innerWidth,
      y: MAP_PADDING + point.y * innerHeight,
    }));
  }, [mapSize, path]);

  const segments = useMemo(() => {
    return projectedPoints.slice(1).map((point, index) => {
      const previous = projectedPoints[index]!;
      const deltaX = point.x - previous.x;
      const deltaY = point.y - previous.y;
      const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);
      const centerX = (point.x + previous.x) / 2;
      const centerY = (point.y + previous.y) / 2;
      const angle = Math.atan2(deltaY, deltaX);

      return {
        angle,
        centerX,
        centerY,
        length,
      };
    });
  }, [projectedPoints]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { height: measuredHeight, width } = event.nativeEvent.layout;
    if (width !== mapSize.width || measuredHeight !== mapSize.height) {
      setMapSize({ height: measuredHeight, width });
    }
  };

  const firstPoint = projectedPoints[0];
  const lastPoint = projectedPoints.at(-1);

  return (
    <View
      accessibilityLabel={`러닝 경로 지도. ${path.length}개 상대 경로 지점`}
      accessibilityRole="image"
      onLayout={handleLayout}
      style={[
        styles.map,
        {
          backgroundColor: colorsForMap.background,
          height,
        },
        style,
      ]}
    >
      <View pointerEvents="none" style={[styles.river, { backgroundColor: colorsForMap.river }]} />
      <View pointerEvents="none" style={[styles.roadHorizontalOne, { backgroundColor: colorsForMap.road }]} />
      <View pointerEvents="none" style={[styles.roadHorizontalTwo, { backgroundColor: colorsForMap.road }]} />
      <View pointerEvents="none" style={[styles.roadVerticalOne, { backgroundColor: colorsForMap.road }]} />
      <View pointerEvents="none" style={[styles.roadVerticalTwo, { backgroundColor: colorsForMap.road }]} />
      <View style={styles.mapHeader}>
        <View>
          <Text style={[styles.mapTitle, { color: colorsForMap.title }]}>운동 경로</Text>
          <Text style={[styles.mapCaption, { color: colorsForMap.caption }]}>{caption}</Text>
        </View>
        <View style={[styles.privacyBadge, dark && styles.privacyBadgeDark]}>
          <Text style={[styles.privacyBadgeText, dark && styles.privacyBadgeTextDark]}>좌표 비저장</Text>
        </View>
      </View>

      {path.length < 2 ? (
        <View style={styles.emptyRoute}>
          <Text style={[styles.emptyRouteText, { color: colorsForMap.caption }]}>
            GPS 경로를 기록하면 여기에 표시돼요
          </Text>
        </View>
      ) : null}

      {segments.map((segment, index) => (
        <View
          key={`${segment.centerX}-${segment.centerY}-${index}`}
          pointerEvents="none"
          style={[
            styles.routeSegment,
            {
              backgroundColor: colorsForMap.route,
              left: segment.centerX - segment.length / 2,
              top: segment.centerY - ROUTE_THICKNESS / 2,
              transform: [
                {
                  rotate: `${segment.angle}rad`,
                },
              ],
              width: segment.length,
            },
          ]}
        />
      ))}

      {firstPoint == null ? null : (
        <View
          pointerEvents="none"
          style={[
            styles.routeMarker,
            styles.startMarker,
            {
              left: firstPoint.x - 8,
              top: firstPoint.y - 8,
            },
          ]}
        >
          <Text style={styles.startMarkerText}>S</Text>
        </View>
      )}
      {lastPoint == null || path.length < 2 ? null : (
        <View
          pointerEvents="none"
          style={[
            styles.routeMarker,
            styles.finishMarker,
            {
              left: lastPoint.x - 8,
              top: lastPoint.y - 8,
            },
          ]}
        >
          <View style={styles.finishMarkerInner} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    borderRadius: radii.large,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  mapHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 15,
    position: 'absolute',
    right: 15,
    top: 13,
    zIndex: 5,
  },
  mapTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  mapCaption: {
    fontSize: 8,
    marginTop: 3,
  },
  privacyBadge: {
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  privacyBadgeDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  privacyBadgeText: {
    color: colors.brandDark,
    fontSize: 8,
    fontWeight: '900',
  },
  privacyBadgeTextDark: {
    color: colors.white,
  },
  river: {
    borderRadius: 30,
    height: 28,
    left: -20,
    position: 'absolute',
    right: -20,
    top: '54%',
    transform: [{ rotate: '-7deg' }],
  },
  roadHorizontalOne: {
    height: 6,
    left: -20,
    position: 'absolute',
    right: -20,
    top: '28%',
    transform: [{ rotate: '8deg' }],
  },
  roadHorizontalTwo: {
    bottom: '19%',
    height: 7,
    left: -20,
    position: 'absolute',
    right: -20,
    transform: [{ rotate: '-13deg' }],
  },
  roadVerticalOne: {
    bottom: -35,
    left: '28%',
    position: 'absolute',
    top: -35,
    transform: [{ rotate: '17deg' }],
    width: 7,
  },
  roadVerticalTwo: {
    bottom: -35,
    position: 'absolute',
    right: '25%',
    top: -35,
    transform: [{ rotate: '-12deg' }],
    width: 5,
  },
  emptyRoute: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 35,
  },
  emptyRouteText: {
    fontSize: 10,
    fontWeight: '700',
  },
  routeSegment: {
    borderRadius: 3,
    height: ROUTE_THICKNESS,
    position: 'absolute',
    zIndex: 3,
  },
  routeMarker: {
    alignItems: 'center',
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    position: 'absolute',
    width: 16,
    zIndex: 4,
  },
  startMarker: {
    backgroundColor: colors.white,
    borderColor: colors.brandDark,
    borderWidth: 2,
  },
  startMarkerText: {
    color: colors.brandDark,
    fontSize: 7,
    fontWeight: '900',
  },
  finishMarker: {
    backgroundColor: colors.white,
    borderColor: colors.orange,
    borderWidth: 2,
  },
  finishMarkerInner: {
    backgroundColor: colors.orange,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
});
