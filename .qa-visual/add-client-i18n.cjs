const fs = require('fs');
const EN = {
  clientsTitle: 'Clients', clientsCount: '{count} clients', searchClients: 'Search name, email, phone',
  filters: 'Filters', saveSmartList: 'Save list', smartListName: 'List name', cancel: 'Cancel',
  noClients: 'No clients yet.', noClientsFiltered: 'No clients match these filters.', pageOf: 'Page {page} of {pages}',
  colPlan: 'Plan', colTags: 'Tags', colMrr: 'Monthly', colLifetime: 'Lifetime', colOwner: 'Owner',
  planPersonalCoaching: 'Personal Coaching', planBootcamp: 'Bootcamp', planBasic: 'Basic',
  statusActive: 'Active', statusPastDue: 'Past due', statusUnpaid: 'Unpaid', statusCanceled: 'Canceled', statusChurned: 'Churned', statusUnknown: 'Unknown',
  standingHealthy: 'Healthy', standingAtRisk: 'At risk', standingChurned: 'Churned',
  facetStanding: 'Standing', facetStatus: 'Status', facetBillingHealth: 'Billing health', facetPlan: 'Plan', facetTags: 'Tags', facetLanguage: 'Language', facetOwner: 'Owner', facetCohort: 'Joined year', facetLegacy: 'Legacy',
  healthPayingCurrent: 'Paying current', healthLapsed: 'Lapsed', healthDueSoonLate: 'Due soon / late', healthNoCharges: 'No charges yet', healthLegacy: 'No billing data',
  catProgram: 'Program', catTier: 'Tier', catHealth: 'Health', catService: 'Service', catLifecycle: 'Lifecycle', catLanguage: 'Language', catSpecial: 'Special', catCustom: 'Custom',
  segAllClients: 'All', segActivePayers: 'Active', segAtRisk: 'At risk', segChurnedWinback: 'Win-back', segCancelling: 'Cancelling', segPersonalCoaching: 'Personal Coaching', segBootcamp: 'Bootcamp', segSixWeek: '6-Week Recomp', segHerAgain: 'HER Again', segHealthFlags: 'PCOS / GLP-1', segSpanishSpeaking: 'Spanish',
  backToClients: 'Back to clients', email: 'Email', message: 'Message',
  tabPayments: 'Payments', tabEngagement: 'Engagement', tabTags: 'Tags',
  grandfatheredPrice: 'Price', grandfatheredMarker: 'Grandfathered', billingHealthLabel: 'Billing health', autoRenew: 'Auto-renew', yes: 'Yes', no: 'No', nextBilling: 'Next billing', nextAmount: 'Next amount', lifetimePaid: 'Lifetime paid', startedAt: 'Started', endedAt: 'Ended',
  ledgerDate: 'Date', ledgerCategory: 'Type', ledgerGross: 'Gross', ledgerCoach: 'Your take', ledgerTotal: 'Running total', noTransactions: 'No payments recorded.',
  engMealPlans: 'Meal plans', engCheckins: 'Check-ins', engWorkouts: 'Workouts', engMeasurements: 'Measurements', engMessages: 'Messages', engHealthAssessment: 'Health score', engWeightGoal: 'Weight goal',
  noData: 'No data yet.', noTags: 'No tags.', contactInfo: 'Contact', owner: 'Owner', sourceDetails: 'Source', sourceLabel: 'Source', tenureDays: 'Days',
};
const ES = {
  clientsTitle: 'Clientes', clientsCount: '{count} clientes', searchClients: 'Buscar nombre, correo, teléfono',
  filters: 'Filtros', saveSmartList: 'Guardar lista', smartListName: 'Nombre de la lista', cancel: 'Cancelar',
  noClients: 'Aún no hay clientes.', noClientsFiltered: 'Ningún cliente coincide con estos filtros.', pageOf: 'Página {page} de {pages}',
  colPlan: 'Plan', colTags: 'Etiquetas', colMrr: 'Mensual', colLifetime: 'Total', colOwner: 'Responsable',
  planPersonalCoaching: 'Coaching Personal', planBootcamp: 'Bootcamp', planBasic: 'Básico',
  statusActive: 'Activo', statusPastDue: 'Vencido', statusUnpaid: 'Sin pagar', statusCanceled: 'Cancelado', statusChurned: 'Perdido', statusUnknown: 'Desconocido',
  standingHealthy: 'Saludable', standingAtRisk: 'En riesgo', standingChurned: 'Perdido',
  facetStanding: 'Estado', facetStatus: 'Suscripción', facetBillingHealth: 'Salud de pago', facetPlan: 'Plan', facetTags: 'Etiquetas', facetLanguage: 'Idioma', facetOwner: 'Responsable', facetCohort: 'Año de inicio', facetLegacy: 'Heredado',
  healthPayingCurrent: 'Al corriente', healthLapsed: 'Caducado', healthDueSoonLate: 'Por vencer / tarde', healthNoCharges: 'Sin cargos aún', healthLegacy: 'Sin datos de pago',
  catProgram: 'Programa', catTier: 'Nivel', catHealth: 'Salud', catService: 'Servicio', catLifecycle: 'Ciclo de vida', catLanguage: 'Idioma', catSpecial: 'Especial', catCustom: 'Personalizado',
  segAllClients: 'Todos', segActivePayers: 'Activos', segAtRisk: 'En riesgo', segChurnedWinback: 'Recuperar', segCancelling: 'Cancelando', segPersonalCoaching: 'Coaching Personal', segBootcamp: 'Bootcamp', segSixWeek: 'Recomp 6 Semanas', segHerAgain: 'HER Again', segHealthFlags: 'PCOS / GLP-1', segSpanishSpeaking: 'Español',
  backToClients: 'Volver a clientes', email: 'Correo', message: 'Mensaje',
  tabPayments: 'Pagos', tabEngagement: 'Participación', tabTags: 'Etiquetas',
  grandfatheredPrice: 'Precio', grandfatheredMarker: 'Heredado', billingHealthLabel: 'Salud de pago', autoRenew: 'Renovación automática', yes: 'Sí', no: 'No', nextBilling: 'Próximo cobro', nextAmount: 'Próximo monto', lifetimePaid: 'Total pagado', startedAt: 'Inicio', endedAt: 'Fin',
  ledgerDate: 'Fecha', ledgerCategory: 'Tipo', ledgerGross: 'Bruto', ledgerCoach: 'Tu parte', ledgerTotal: 'Total acumulado', noTransactions: 'Sin pagos registrados.',
  engMealPlans: 'Planes de comida', engCheckins: 'Check-ins', engWorkouts: 'Entrenamientos', engMeasurements: 'Mediciones', engMessages: 'Mensajes', engHealthAssessment: 'Puntaje de salud', engWeightGoal: 'Meta de peso',
  noData: 'Aún no hay datos.', noTags: 'Sin etiquetas.', contactInfo: 'Contacto', owner: 'Responsable', sourceDetails: 'Origen', sourceLabel: 'Origen', tenureDays: 'Días',
};
function merge(loc, dict) {
  const p = `./src/messages/${loc}.json`;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  let added = 0;
  for (const [k, v] of Object.entries(dict)) {
    if (!(k in j.app.coach)) { j.app.coach[k] = v; added++; }
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log(loc, 'added', added, 'now', Object.keys(j.app.coach).length);
}
merge('en', EN);
merge('es', ES);
