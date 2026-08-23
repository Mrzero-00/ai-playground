import React from 'react';
import { render } from '@testing-library/react-native';
import { RunRouteMap } from './RunRouteMap';

describe('러닝 경로 지도', () => {
  it('상대 경로 지점 개수를 접근성 정보로 제공한다', () => {
    const screen = render(
      <RunRouteMap
        path={[
          { x: 0.1, y: 0.8 },
          { x: 0.5, y: 0.4 },
          { x: 0.9, y: 0.2 },
        ]}
      />
    );

    expect(screen.getByLabelText('러닝 경로 지도. 3개 상대 경로 지점')).toBeTruthy();
  });

  it('경로가 없으면 GPS 안내를 표시한다', () => {
    const screen = render(<RunRouteMap path={[]} />);

    expect(screen.getByText('GPS 경로를 기록하면 여기에 표시돼요')).toBeTruthy();
  });
});
