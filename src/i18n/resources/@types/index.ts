// Copyright (c) 2026 bwedirhan. MIT License.
export interface LanguageResources {
  [lang: string]: {
    translation: Record<string, unknown> & {
      language?: {
        'name': string;
        'local-name': string;
        'code': string;
      };
    };
  };
}
