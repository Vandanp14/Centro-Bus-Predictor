import React from 'react';

function ScheduleTable({ scheduleData, loading }) {
  if (loading) {
    return (
      <div className="schedule-table__empty">
        Loading schedule…
      </div>
    );
  }

  if (!scheduleData || scheduleData.length === 0) {
    return (
      <div className="schedule-table__empty">
        No schedule available for this route.
      </div>
    );
  }

  const stops = scheduleData.stops || [];
  const rows = scheduleData.rows || [];

  return (
    <div className="schedule-table">
      <div className="schedule-table__scroll">
        <table>
          <caption>Scheduled Arrival Times</caption>
          <thead>
            <tr>
              {stops.map((stop, index) => (
                <th key={index}>{stop}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((time, cellIndex) => (
                  <td key={cellIndex}>{time}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ScheduleTable;
