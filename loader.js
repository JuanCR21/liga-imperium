const LIGA_API_URL = "https://liga-imperium-api.juanchicharro2007.workers.dev";

window.LIGA_READY = fetch(`${LIGA_API_URL}/liga`, {
  method: "GET",
  cache: "no-store"
})
  .then(async response => {
    if (!response.ok) {
      throw new Error(`Error API Liga Imperium: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data || typeof data !== "object" || !data.seasons) {
      throw new Error("La API devolvió una estructura LIGA_DATA inválida.");
    }

    window.LIGA_DATA = data;

    return data;
  })
  .catch(error => {
    console.error(error);

    document.body.innerHTML = `
      <main style="
        min-height:100vh;
        display:grid;
        place-items:center;
        padding:2rem;
        font-family:system-ui,sans-serif;
        text-align:center;
      ">
        <div>
          <h1>No se han podido cargar los datos de la liga</h1>
          <p>Comprueba tu conexión e inténtalo de nuevo.</p>
        </div>
      </main>
    `;

    throw error;
  });
