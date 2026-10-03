// Copyright (c) 2026 bwedirhan. MIT License.
export interface MusicPlayerAppElement extends HTMLElement {
  navigate(page: string): void;
  networkManager: {
    fetch: <ReturnType, Data>(url: string, data: Data) => Promise<ReturnType>;
  };
}
