/** SHA-256 do conteúdo em hex minúsculo. Identifica o livro pelo conteúdo, não pelo nome. */
export async function hashArquivo(dados) {
  const buffer = dados instanceof Blob ? await dados.arrayBuffer() : dados;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
