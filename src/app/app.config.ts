import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { mockApiInterceptor } from './core/http/mock-api-interceptor';
import { ThemeStore } from './core/state/theme-store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([mockApiInterceptor])),
    // Тема должна стоять на <html> до первого рендера — графики читают токены.
    provideAppInitializer(() => {
      inject(ThemeStore);
    }),
  ],
};
