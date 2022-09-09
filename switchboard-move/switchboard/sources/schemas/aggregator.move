module switchboard::aggregator {
    use aptos_framework::timestamp;
    use aptos_framework::block;
    use switchboard::math::{Self, SwitchboardDecimal};
    use switchboard::errors;
    use std::option::{Self, Option};
    use std::signer; 
    use std::vector;
    use std::coin::{Self, Coin};

    struct AggregatorRound has store, copy, drop {
        // Maintains the current update count
        id: u128,
        // Maintains the time that the round was opened at.
        round_open_timestamp: u64,
        // Maintain the blockheight at the time that the round was opened
        round_open_block_height: u64,
        // Maintains the current median of all successful round responses.
        result: SwitchboardDecimal,
        // Standard deviation of the accepted results in the round.
        std_deviation: SwitchboardDecimal,
        // Maintains the minimum node response this round.
        min_response: SwitchboardDecimal,
        // Maintains the maximum node response this round.
        max_response: SwitchboardDecimal,
        // Pubkeys of the oracles fulfilling this round.
        oracle_keys: vector<address>,
        // Represents all successful node responses this round. `NaN` if empty.
        medians: vector<Option<SwitchboardDecimal>>,
        // Current rewards/slashes oracles have received this round.
        current_payout: vector<SwitchboardDecimal>,
        // could do specific error codes
        errors_fulfilled: vector<bool>,
        // Maintains the number of successful responses received from nodes.
        // Nodes can submit one successful response per round.
        num_success: u64,
        num_error: u64,
        // Maintains whether or not the round is closed
        is_closed: bool,
        // Maintains whether a read is available or not
        locked: bool,
        // Maintains the round close timestamp
        round_confirmed_timestamp: u64,
    }

    public fun default_round(): AggregatorRound {
        AggregatorRound {
            id: 0,
            round_open_timestamp: 0,
            round_open_block_height: block::get_current_block_height(),
            result: math::zero(),
            std_deviation: math::zero(),
            min_response: math::zero(),
            max_response: math::zero(),
            oracle_keys: vector::empty(),
            medians: vector::empty(),
            current_payout: vector::empty(),
            errors_fulfilled: vector::empty(),
            num_error: 0,
            num_success: 0,
            locked: false,
            is_closed: false,
            round_confirmed_timestamp: 0,
        }
    }

    struct Aggregator has key, store, drop {

        // CONFIGS
        name: vector<u8>,
        metadata: vector<u8>,
        queue_addr: address,
        batch_size: u64,
        min_oracle_results: u64,
        min_job_results: u64,
        min_update_delay_seconds: u64,
        start_after: u64,
        variance_threshold: SwitchboardDecimal,
        force_report_period: u64,
        expiration: u64,
        authority: address,
        read_charge: u64,
        reward_escrow: address,
        crank_disabled: bool,
        next_allowed_update_time: u64,
        consecutive_failure_count: u64,
        is_locked: bool,
        crank_addr: address,
        latest_confirmed_round: AggregatorRound,
        previous_confirmed_round_result: SwitchboardDecimal,
        previous_confirmed_round_block_height: u64,
        current_round: AggregatorRound,
        job_keys: vector<address>,
        job_weights: vector<u8>,
        jobs_checksum: vector<u8>,
        history: vector<AggregatorHistoryRow>,
        history_limit: u64,
        history_write_idx: u64,
        created_at: u64,
        crank_row_count: u64,
        gas_price: u64,
        gas_price_feed: address,
        _ebuf: vector<u8>,
    }


    struct AggregatorHistory has drop, store {
        buffer: vector<AggregatorHistoryRow>,
        current_round_id: u128,
    }

    struct AggregatorHistoryRow has drop, copy, store {
        value: SwitchboardDecimal,
        timestamp: u64,
        round_id: u128,
    }

    struct AggregatorConfigParams has drop, copy {
        addr: address,
        name: vector<u8>,
        metadata: vector<u8>,
        queue_addr: address,
        batch_size: u64,
        min_oracle_results: u64,
        min_job_results: u64,
        min_update_delay_seconds: u64,
        start_after: u64,
        variance_threshold: SwitchboardDecimal,
        force_report_period: u64,
        expiration: u64,
        disable_crank: bool,
        history_limit: u64,
        read_charge: u64,
        reward_escrow: address,
        gas_price: u64,
        gas_price_feed: address,
        authority: address,
    }

    public fun addr_from_conf(conf: &AggregatorConfigParams): address {
        conf.addr
    }

    public fun queue_from_conf(conf: &AggregatorConfigParams): address {
        conf.queue_addr
    }

    public fun authority_from_conf(conf: &AggregatorConfigParams): address {
        conf.authority
    }

    public fun history_limit_from_conf(conf: &AggregatorConfigParams): u64 {
        conf.history_limit
    }
    
    public fun batch_size_from_conf(conf: &AggregatorConfigParams): u64 {
        conf.batch_size
    }

    public fun min_oracle_results_from_conf(conf: &AggregatorConfigParams): u64 {
        conf.min_oracle_results
    }

    public fun min_update_delay_seconds_from_conf(conf: &AggregatorConfigParams): u64 {
        conf.min_update_delay_seconds
    }

    public(friend) fun new_config(
        addr: address,
        name: vector<u8>,
        metadata: vector<u8>,
        queue_addr: address,
        batch_size: u64,
        min_oracle_results: u64,
        min_job_results: u64,
        min_update_delay_seconds: u64,
        start_after: u64,
        variance_threshold: SwitchboardDecimal,
        force_report_period: u64,
        expiration: u64,
        disable_crank: bool,
        history_limit: u64,
        read_charge: u64,
        reward_escrow: address,
        gas_price: u64,
        gas_price_feed: address,
        authority: address,
    ): AggregatorConfigParams {
        AggregatorConfigParams {
            addr,
            name,
            metadata,
            queue_addr,
            batch_size,
            min_oracle_results,
            min_job_results,
            min_update_delay_seconds,
            start_after,
            variance_threshold,
            force_report_period,
            expiration,
            disable_crank,
            history_limit,
            read_charge,
            reward_escrow,
            gas_price,
            gas_price_feed,
            authority,
        }
    }

    public fun exist(addr: address): bool {
        exists<Aggregator>(addr)
    }

    public fun has_authority(addr: address, account: &signer): bool acquires Aggregator {
        let ref = borrow_global<Aggregator>(addr);
        ref.authority == signer::address_of(account)
    }

    public fun unlock_read<CoinType>(account: &signer, addr: address): address acquires Aggregator {
        let aggregator = borrow_global_mut<Aggregator>(addr);
        coin::transfer<CoinType>(account, aggregator.reward_escrow, aggregator.read_charge);
        aggregator.latest_confirmed_round.locked = false;
        addr
    }

    public fun unlock_read_with_coin<CoinType>(addr: address, fee: Coin<CoinType>): address acquires Aggregator {
        let aggregator = borrow_global_mut<Aggregator>(addr);
        assert!(coin::value(&fee) == aggregator.read_charge, errors::InvalidArgument());
        coin::deposit(aggregator.reward_escrow, fee);
        aggregator.latest_confirmed_round.locked = false;
        addr
    }

    public fun latest_value(addr: address): SwitchboardDecimal acquires Aggregator {
        let aggregator = borrow_global_mut<Aggregator>(addr);
        assert!(aggregator.latest_confirmed_round.locked == false, errors::PermissionDenied());
        let has_read_charge = aggregator.read_charge > 0;
        aggregator.latest_confirmed_round.locked = has_read_charge; // lock the result again
        // grab a copy of latest result
        aggregator.latest_confirmed_round.result
    }

    public fun latest_round(addr: address): (
        SwitchboardDecimal, /* Result */
        u64,                /* Round Confirmed Timestamp */
        SwitchboardDecimal, /* Standard Deviation of Oracle Responses */
        SwitchboardDecimal, /* Min Oracle Response */
        SwitchboardDecimal, /* Max Oracle Response */
    ) acquires Aggregator {
        let aggregator = borrow_global_mut<Aggregator>(addr);
        assert!(aggregator.latest_confirmed_round.locked == false, errors::PermissionDenied());
        let has_read_charge = aggregator.read_charge > 0;
        aggregator.latest_confirmed_round.locked = has_read_charge;
        (
            aggregator.latest_confirmed_round.result,
            aggregator.latest_confirmed_round.round_confirmed_timestamp,
            aggregator.latest_confirmed_round.std_deviation,
            aggregator.latest_confirmed_round.min_response,
            aggregator.latest_confirmed_round.max_response,
        )
    }

    // GETTERS

    public fun latest_confirmed_round_timestamp(addr: address): u64 acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.latest_confirmed_round.round_confirmed_timestamp
    }

    public fun latest_round_open_timestamp(addr: address): u64 acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.latest_confirmed_round.round_open_timestamp
    }   

    public fun authority(addr: address): address acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.authority
    }

    public fun gas_price(addr: address): u64 acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.gas_price
    }

    public fun gas_price_feed(addr: address): address acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.gas_price_feed
    }

    public fun is_locked(addr: address): bool acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.is_locked
    }

    public fun read_charge(addr: address): u64 acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.read_charge
    }

    public fun next_allowed_timestamp(addr: address): u64 acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.next_allowed_update_time
    }

    public fun job_keys(addr: address): vector<address> acquires Aggregator {
        borrow_global<Aggregator>(addr).job_keys
    }

    public fun min_oracle_results(addr: address): u64 acquires Aggregator {
        borrow_global<Aggregator>(addr).min_oracle_results
    }

    public fun crank_addr(addr: address): address acquires Aggregator {
        borrow_global<Aggregator>(addr).crank_addr
    }

    public fun crank_disabled(addr: address): bool acquires Aggregator {
        borrow_global<Aggregator>(addr).crank_disabled
    }

    public(friend) fun crank_row_count(self: address): u64 acquires Aggregator {
        borrow_global<Aggregator>(self).crank_row_count
    }

    public fun current_round_num_success(addr: address): u64 acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.current_round.num_success
    }

    public fun current_round_open_timestamp(addr: address): u64 acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.current_round.round_open_timestamp
    }

    public fun current_round_num_error(addr: address): u64 acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.current_round.num_error
    }

    public fun curent_round_oracle_key_at_idx(addr: address, idx: u64): address acquires Aggregator {
        *vector::borrow(&borrow_global<Aggregator>(addr).current_round.oracle_keys, idx)
    }
    
    public fun current_round_std_dev(addr: address): SwitchboardDecimal acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.current_round.std_deviation
    }

    public fun current_round_result(addr: address): SwitchboardDecimal acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        aggregator.current_round.result
    }

    public fun is_median_fulfilled(addr: address, idx: u64): bool acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        let val = vector::borrow(&aggregator.current_round.medians, idx);
        option::is_some(val)
    }

    public fun is_error_fulfilled(addr: address, idx: u64): bool acquires Aggregator {
        let aggregator = borrow_global<Aggregator>(addr);
        *vector::borrow(&aggregator.current_round.errors_fulfilled, idx)
    }

    public fun batch_size(self: address): u64 acquires Aggregator {
        borrow_global<Aggregator>(self).batch_size
    }
    
    public fun queue_addr(addr: address): address acquires Aggregator {
        borrow_global<Aggregator>(addr).queue_addr
    }

    public fun history_limit(self: address): u64 acquires Aggregator {
        borrow_global<Aggregator>(self).history_limit
    }
    
    public fun can_open_round(addr: address): bool acquires Aggregator {
        let ref = borrow_global<Aggregator>(addr);
        timestamp::now_seconds() >= ref.start_after &&
        timestamp::now_seconds() >= ref.next_allowed_update_time
    }

     #[test_only]
    public entry fun new_test(account: &signer, value: u128, dec: u8, sign: bool) {
        let aggregator = Aggregator {
            name: vector::empty(),
            metadata: vector::empty(),
            queue_addr: @0x55,
            batch_size: 3,
            min_oracle_results: 1,
            min_job_results: 1,
            min_update_delay_seconds: 5,
            start_after: 0,
            variance_threshold: math::new(0, 0, false),
            force_report_period: 0, 
            expiration: 0,
            next_allowed_update_time: 0,
            is_locked: false,
            crank_addr: @0x55,
            consecutive_failure_count: 0,
            latest_confirmed_round: AggregatorRound {
                round_open_timestamp: 0,
                result: math::new(value, dec, sign),
                std_deviation: math::new(3141592653, 9, false),
                min_response: math::new(3141592653, 9, false),
                max_response: math::new(3141592653, 9, false),
                oracle_keys: vector::empty(),
                medians: vector::empty(),
                current_payout: vector::empty(),
                errors_fulfilled: vector::empty(),
                num_success: 0,
                num_error: 0,
                locked: false,
                id: 0,
                is_closed: false,
                round_confirmed_timestamp: 0,
                round_open_block_height: 0,
            },
            current_round: AggregatorRound {
                round_open_timestamp: 0,
                result: math::zero(),
                std_deviation: math::zero(),
                min_response: math::zero(),
                max_response: math::zero(),
                oracle_keys: vector::empty(),
                medians: vector::empty(),
                current_payout: vector::empty(),
                errors_fulfilled: vector::empty(),
                num_success: 0,
                num_error: 0,
                locked: false,
                id: 0,
                is_closed: false,
                round_confirmed_timestamp: 0,
                round_open_block_height: 0,
            },
            job_keys: vector::empty(),
            job_weights: vector::empty(),
            jobs_checksum: vector::empty(),
            authority: @0x55,
            crank_disabled: false,
            created_at: 0,
            crank_row_count: 0,
            history: vector::empty(),
            history_limit: 0,
            history_write_idx: 0,
            previous_confirmed_round_result: math::zero(),
            previous_confirmed_round_block_height: 0,
            _ebuf: vector::empty(),
            read_charge: 0,
            reward_escrow: @0x55,
            gas_price: 1,
            gas_price_feed: @0x0,
        };

        move_to<Aggregator>(account, aggregator);
    }

    #[test_only]
    public entry fun update_value(account: &signer, value: u128, dec: u8, neg: bool) acquires Aggregator {
        let ref = borrow_global_mut<Aggregator>(signer::address_of(account));
        ref.latest_confirmed_round.result = math::new(value, dec, neg);
    }

}
