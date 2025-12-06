const query = `query MyQuery {
  areas(filter: {area_name: {match: "/* Yosemite Valley Bouldering"}}) {
    area_name
    children {
      area_name
      climbs {
        name
        grades {
          vscale
          font
        }
        metadata {
          lat
          lng
        }
      }
      children {
        area_name
        climbs {
          name
          grades {
            vscale
            font
          }
          metadata {
            lat
            lng
          }
        }
      }
    }
  }
}
`;

fetch("https://api.openbeta.io/graphql", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({query})
});