import GraphiQL from "graphiql";
import "graphiql/graphiql.css";
import React from "react";
import ReactDOM from "react-dom";
import "./index.css";

window.gqlmapi.startService();

let _observableId = 0;
let _observables = [];

function fetchQuery(params) {
  const query = params.query;

  if (query === undefined) {
    return Promise.reject("undefined query!");
  }

  const operationName = params.operationName || "";
  const variables = params.variables ? JSON.stringify(params.variables) : "";

  console.log(`Query: ${query}`);
  console.log(`Operation: ${operationName}`);
  console.log(`Variables: ${variables}`);

  const observable = {
    queryId: null,
    unsubscribed: false,
    observableId: _observableId++,
    observerId: 0,
    subscriptions: [],

    subscribe: (observer) => {
      const observerId = observable.observerId++;
      const subscription = {
        observer,
        observerId,

        unsubscribe: () => {
          observable.subscriptions = observable.subscriptions.filter(
            (subscription) => subscription.observerId !== observerId
          );
          observable.onUnsubscribe();
        },
      };

      observable.subscriptions.push(subscription);
      return subscription;
    },

    onUnsubscribe: () => {
      if (observable.subscriptions.length === 0) {
        observable.unsubscribed = true;
        _observables = _observables.filter(
          (observableId) => observable.observableId !== observableId
        );
        const queryId = observable.queryId;
        if (queryId !== null) {
          window.gqlmapi
            .unsubscribe(queryId)
            .then(() => window.gqlmapi.discardQuery(queryId));
        }
      }
    },

    onNext: (response) => {
      observable.subscriptions.forEach((subscription) => {
        if (typeof subscription.observer === "function") {
          subscription.observer(response);
          subscription.unsubscribe();
        } else {
          subscription.observer.next(response);
        }
      });
    },

    onComplete: () => {
      observable.subscriptions.forEach((subscription) => {
        if (typeof subscription.observer === "object") {
          subscription.observer.complete();
        }
      });
      observable.subscriptions = [];
      observable.onUnsubscribe();
    },
  };
  _observables[observable.observableId] = observable;

  window.gqlmapi.parseQuery(query).then((queryId) => {
    if (observable.unsubscribed) {
      return window.gqlmapi.discardQuery(queryId);
    }

    observable.queryId = queryId;
    return window.gqlmapi.fetchQuery(
      queryId,
      operationName,
      variables,
      (payload) => observable.onNext(payload),
      () => observable.onComplete()
    );
  });

  return observable;
}

ReactDOM.render(
  <GraphiQL fetcher={fetchQuery} />,
  document.getElementById("root")
);
