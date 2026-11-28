// Vitest vigente coleta apenas server/client: este wrapper registra as suites67 reais.
// A captura SQL→APP permanece explicitamente SKIP sem CONTROLES67_SQL_CAPTURE.
import '../tests/controles67/helper67.test';
import '../tests/controles67/prepost67.test';
import '../tests/controles67/router67.test';
import '../tests/controles67/runtime67.test';
import '../tests/controles67/sql-app67.test';
import '../tests/controles67/ui67.test';
