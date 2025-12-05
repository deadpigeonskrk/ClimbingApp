import "./style.css";
import { setupButton } from "./dm.ts";
import { tab, } from "./dm.ts";


document.querySelector<HTMLDivElement>("#app")!.innerHTML = `

<div class="container">
    <img src="./src/smaller_vers.png" alt="scout_camp" />

    <div class="card">
      <button id="counter" type="button"></button>
    </div>

    <div class="card">
      <table id="name_object" border="0"></table>
    </div>
</div>

`;

setupButton(document.querySelector<HTMLButtonElement>("#counter")!);
tab(document.querySelector<HTMLTableElement>("#name_object")!);
