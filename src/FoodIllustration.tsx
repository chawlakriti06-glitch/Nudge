// Decorative illustrations represent meal categories, never exact recipes.
export function FoodIllustration({
  name,
  slot,
}: {
  name: string;
  slot: string;
}) {
  const text = name.toLowerCase();
  const bread = /roti|chapati|paratha|toast|sandwich|chilla|dosa/.test(text);
  const idli = /idli/.test(text);
  const sweet = /yog|curd|fruit|pudding|dessert|chocolate|banana/.test(text);
  const snack = slot === "Snacks";
  return (
    <svg
      viewBox="0 0 360 220"
      preserveAspectRatio="xMidYMid slice"
      className="food-illustration"
      role="img"
      aria-label={`${slot} food illustration, not the exact recipe`}
    >
      <rect
        width="360"
        height="220"
        fill={sweet ? "#f7e9e2" : bread ? "#f2eadc" : "#e8efe7"}
      />
      <circle cx="305" cy="25" r="100" fill="#ffffff" opacity=".32" />
      <path d="M0 193 Q140 135 360 180 V220 H0Z" fill="#fffdf8" opacity=".45" />
      <ellipse
        cx="179"
        cy="178"
        rx="120"
        ry="20"
        fill="#173e53"
        opacity=".09"
      />
      <ellipse cx="180" cy="116" rx="119" ry="73" fill="#fbfaf5" />
      <ellipse cx="180" cy="112" rx="108" ry="64" fill="#dcded4" />
      <ellipse cx="180" cy="110" rx="100" ry="58" fill="#fffdf7" />
      {bread ? (
        <g>
          <ellipse
            cx="155"
            cy="107"
            rx="64"
            ry="42"
            fill="#dca760"
            transform="rotate(-10 155 107)"
          />
          <ellipse
            cx="161"
            cy="97"
            rx="62"
            ry="40"
            fill="#e9bd79"
            transform="rotate(8 161 97)"
          />
          {[
            [-25, -12],
            [0, 15],
            [21, -18],
            [-15, 18],
            [29, 6],
            [-40, 5],
          ].map(([x, y], i) => (
            <ellipse
              key={i}
              cx={161 + x}
              cy={97 + y}
              rx={5}
              ry={3}
              fill="#ad7948"
              opacity=".6"
            />
          ))}
          <ellipse cx="247" cy="131" rx="30" ry="23" fill="#476664" />
          <ellipse cx="247" cy="125" rx="26" ry="19" fill="#df9357" />
          <path
            d="M242 123q-11-12-17-3q11 9 17 3m0 0q12-12 17-3q-10 9-17 3"
            fill="#557c48"
          />
        </g>
      ) : idli ? (
        <g>
          {[
            [141, 99],
            [204, 95],
            [173, 133],
          ].map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y + 4} rx="33" ry="23" fill="#e1dfd3" />
              <ellipse cx={x} cy={y} rx="33" ry="23" fill="#fffdf4" />
              <path
                d={`M${x - 14} ${y - 8}q12-8 28 0`}
                stroke="#e9e5d9"
                strokeWidth="2"
                fill="none"
              />
            </g>
          ))}
          <ellipse cx="252" cy="137" rx="22" ry="17" fill="#9bac85" />
        </g>
      ) : sweet ? (
        <g>
          <path
            d="M111 101 Q113 166 180 170 Q247 166 249 101Z"
            fill="#446569"
          />
          <ellipse cx="180" cy="101" rx="69" ry="39" fill="#f7f4e8" />
          <ellipse cx="180" cy="100" rx="60" ry="32" fill="#e5d4b4" />
          {[
            [143, 94],
            [175, 79],
            [201, 103],
            [166, 115],
            [211, 83],
          ].map(([x, y], i) => (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="12"
              ry="8"
              fill={i % 2 ? "#c6755e" : "#e9bd6e"}
              transform={`rotate(${i * 27} ${x} ${y})`}
            />
          ))}
          <path
            d="M184 91q-17-23-24-8q12 14 24 8q14-16 23-8q-10 15-23 8"
            fill="#5f8156"
          />
        </g>
      ) : (
        <g>
          <path
            d="M101 100 Q109 164 180 171 Q251 164 259 100Z"
            fill="#486a66"
          />
          <ellipse cx="180" cy="99" rx="79" ry="43" fill="#f9f8ee" />
          <ellipse
            cx="180"
            cy="99"
            rx="68"
            ry="34"
            fill={snack ? "#b99260" : "#ddbc71"}
          />
          {Array.from({ length: 28 }, (_, i) => (
            <ellipse
              key={i}
              cx={130 + ((i * 23) % 100)}
              cy={80 + ((i * 17) % 37)}
              rx={snack ? 4 : 5}
              ry={snack ? 4 : 2}
              fill={
                i % 3 === 0 ? "#c77b59" : i % 3 === 1 ? "#759258" : "#f4e4b9"
              }
              transform={`rotate(${i * 19} ${130 + ((i * 23) % 100)} ${80 + ((i * 17) % 37)})`}
            />
          ))}
          <path
            d="M184 103q-21-19-25-7q16 14 25 7q18-23 24-10q-12 17-24 10"
            fill="#477d51"
          />
        </g>
      )}
      <path
        d="M296 69l-21 93"
        stroke="#a9b4a6"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <ellipse
        cx="298"
        cy="60"
        rx="8"
        ry="15"
        fill="#b9c2b4"
        transform="rotate(14 298 60)"
      />
      <path
        d="M70 150q-20-22-29-5q12 21 29 5q9-29 20-20q-1 19-20 20"
        fill="#7c936c"
      />
    </svg>
  );
}
