const DIA = 24 * 60 * 60 * 1000;

function inicioDoDia(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "hoje", "ontem", "há N dias", "há N semanas" ou a data (a partir de 30 dias). */
export function tempoRelativo(ts, agora = Date.now()) {
  const dias = Math.round((inicioDoDia(agora) - inicioDoDia(ts)) / DIA);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 30) {
    const semanas = Math.floor(dias / 7);
    return semanas === 1 ? 'há 1 semana' : `há ${semanas} semanas`;
  }
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
