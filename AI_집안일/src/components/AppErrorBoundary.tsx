import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('집토리 화면을 표시하지 못했어요.', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-screen" role="alert">
          <div className="app-error-graphic" aria-hidden="true">🏠</div>
          <h1>화면을 불러오지 못했어요</h1>
          <p>잠시 후 다시 열어 주세요. 같은 문제가 계속되면 고객센터로 알려주세요.</p>
          <button type="button" onClick={() => window.location.reload()}>
            다시 불러오기
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
