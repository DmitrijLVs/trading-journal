/**
 * Прод: фронт и гейтвей на разных хостах — запросы к API идут прямо на гейтвей.
 * Дев-сборка подменяет файл на environment.development.ts (angular.json).
 */
export const environment = {
  /** Origin гейтвея платформы; '' — тот же хост, что и у приложения. */
  apiOrigin: 'https://165.245.248.24',
};
