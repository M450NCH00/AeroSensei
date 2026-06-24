package com.aerosensei.repository;

import com.aerosensei.entity.PmAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PmAlertRepository extends JpaRepository<PmAlert, Long> {
    List<PmAlert> findAllByOrderByTriggeredAtDesc();

    List<PmAlert> findBySiteIdInOrderByTriggeredAtDesc(List<Long> siteIds);
}
