package com.example.mendix.stress;

import java.math.BigDecimal;
import java.time.Instant;

public record StressRowData(long rowNumber, String name, String description,
                            String category, BigDecimal amount, Instant rowDate, String status) { }
