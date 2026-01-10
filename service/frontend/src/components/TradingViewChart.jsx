import { useEffect, useRef } from "react";

const TradingViewChart = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (window.TradingView) {
      createWidget();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = createWidget;
    document.body.appendChild(script);

    function createWidget() {
      new window.TradingView.widget({
        container_id: containerRef.current.id,
        symbol: "NSE:RELIANCE",
        interval: "5",
        timezone: "Asia/Kolkata",
        theme: "dark",
        style: "1",
        locale: "en",
        autosize: true,
        allow_symbol_change: true
      });
    }
  }, []);

  return (
    <div
      id="tv_chart_container"
      ref={containerRef}
      style={{ height: "600px", width: "100%" }}
    />
  );
};

export default TradingViewChart;

