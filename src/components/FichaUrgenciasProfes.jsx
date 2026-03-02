import { useNavigate } from "react-router-dom";
import urgLogo from "../assets/urg-urgencias.svg";

export default function FichaUrgenciasProfes() {
  const navigate = useNavigate();
  const telefonoUrg = "0810 444 351111";
  const telefonoUrgAlt = "0810 333 351111";
  const codigoCorto = "*URG";

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 px-4">
      <div className="flex items-center justify-between mb-5 gap-4">
        <div />
        <button
          onClick={() => navigate("/menu-profes")}
          className="inline-flex shrink-0 w-auto whitespace-nowrap items-center px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200"
          style={{ border: "1px solid #d1d5db" }}
        >
          Volver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col items-center gap-4 text-center">
          <img src={urgLogo} alt="URG Urgencias" className="w-full max-w-[320px] h-auto" />
          <div>
            <a
              href={`tel:${telefonoUrg.replace(/\s/g, "")}`}
              className="text-2xl font-bold text-blue-700 hover:text-blue-800"
            >
              {telefonoUrg}
            </a>
            <div className="mt-2 text-2xl font-bold text-blue-700">
              <a href={`tel:${telefonoUrgAlt.replace(/\s/g, "")}`} className="hover:text-blue-800">
                {telefonoUrgAlt}
              </a>
            </div>
            <div className="mt-1 text-lg font-bold text-cyan-700">{codigoCorto}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
