CREATE TABLE ETA(
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    stpid CHAR(6) NOT NULL,
    rt CHAR(10) NOT NULL,
    FOREIGN KEY (stpid) REFERENCES Stops(stupid),
    FOREIGN KEY (rt) REFERENCES Routes(rt),
    prdtm TIMESTAMP NOT NULL COMMENT 'Predicted Arrival Timestamp',
    prdctdn INT NOT NULL COMMENT 'Predicted Arrival Countdown in Minutes. DUE = 0',
    tmstmp TIMESTAMP NOT NULL COMMENT 'Current Timestamp',
    dly BOOLEAN NOT NULL COMMENT 'delay status',
    rtdir VARCHAR(50) NOT NULL COMMENT 'route direction',
    UNIQUE KEY eta_snapshot_unique (stpid, rt, prdtm, tmstmp, rtdir),
    KEY eta_live_lookup (rt, rtdir, stpid, tmstmp),
    KEY eta_history_lookup (rt, stpid, tmstmp)
);
